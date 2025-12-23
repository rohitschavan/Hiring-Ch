const axios = require('axios');
let HfInference;
try {
  HfInference = require('@huggingface/inference').HfInference;
} catch (e) {
  // Package not installed, will use axios fallback
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const AI_PROVIDER = process.env.AI_PROVIDER || 'openai';
const AI_MODEL = process.env.AI_MODEL || 'gpt-4o-mini';

async function generateInsight(tokenData) {
  // Step 2: Build structured prompt
  const prompt = buildPrompt(tokenData);

  // Step 3: Call chosen AI model with prompt
  try {
    if (AI_PROVIDER === 'huggingface' && HUGGINGFACE_API_KEY) {
      return await callHuggingFace(prompt);
    } else if (AI_PROVIDER === 'openai' && OPENAI_API_KEY) {
      return await callOpenAI(prompt);
    } else {
      console.warn('No AI API key configured, using mock response');
      return getMockResponse(tokenData);
    }
  } catch (error) {
    console.warn('AI API error, using mock response:', error.message);
    return getMockResponse(tokenData);
  }
}

async function callOpenAI(prompt) {
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: AI_MODEL,
        messages: [
          { role: 'system', content: 'You are a cryptocurrency analyst. Respond with valid JSON only.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 300
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Step 4: Parse & validate AI response (must be valid JSON)
    const content = response.data.choices[0].message.content.trim();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    
    let insight;
    try {
      insight = JSON.parse(jsonStr);
    } catch (parseError) {
      throw new Error('AI response is not valid JSON');
    }

    // Validate required fields
    if (!insight.reasoning || !insight.sentiment) {
      throw new Error('AI response missing required fields (reasoning, sentiment)');
    }

    // Validate sentiment value
    const validSentiments = ['Bullish', 'Bearish', 'Neutral'];
    if (!validSentiments.includes(insight.sentiment)) {
      insight.sentiment = 'Neutral';
    }

    return {
      reasoning: insight.reasoning,
      sentiment: insight.sentiment,
      provider: 'openai',
      model: AI_MODEL
    };
  } catch (error) {
    console.warn('OpenAI API error:', error.message);
    throw error;
  }
}

async function callHuggingFace(prompt) {
  try {
    // Try multiple approaches: SDK first, then direct API
    if (HfInference) {
      const hf = new HfInference(HUGGINGFACE_API_KEY);
      
      // Try different models that are commonly available
      const models = [
        { name: 'meta-llama/Meta-Llama-3-8B-Instruct', type: 'chat' },
        { name: 'google/flan-t5-large', type: 'text' },
        { name: 'microsoft/DialoGPT-medium', type: 'text' },
        { name: 'distilgpt2', type: 'text' }
      ];
      
      for (const modelConfig of models) {
        try {
          let content = '';
          
          if (modelConfig.type === 'chat') {
            // Try chat completion
            const response = await hf.chatCompletion({
              model: modelConfig.name,
              messages: [{ role: 'user', content: prompt }],
              max_tokens: 300,
              temperature: 0.7
            });
            content = response.choices?.[0]?.message?.content || '';
          } else {
            // Try text generation
            const response = await hf.textGeneration({
              model: modelConfig.name,
              inputs: prompt,
              parameters: {
                max_new_tokens: 200,
                temperature: 0.7,
                return_full_text: false
              }
            });
            content = typeof response === 'string' ? response : response.generated_text || '';
          }
          
          if (content) {
            return parseAndValidateResponse(content, modelConfig.name);
          }
        } catch (modelError) {
          console.warn(`Model ${modelConfig.name} failed:`, modelError.message);
          continue;
        }
      }
    }
    
    // Fallback: Use direct API endpoint with axios
    return await callHuggingFaceDirect(prompt);
    
  } catch (error) {
    console.warn('Hugging Face API error:', error.message);
    throw error;
  }
}

async function callHuggingFaceDirect(prompt) {
  // Try direct API endpoint - more reliable for some models
  const models = [
    'google/flan-t5-base',
    'distilgpt2',
    'gpt2'
  ];
  
  for (const model of models) {
    try {
      const response = await axios.post(
        `https://api-inference.huggingface.co/models/${model}`,
        {
          inputs: prompt,
          parameters: {
            max_new_tokens: 200,
            temperature: 0.7,
            return_full_text: false
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );
      
      // Handle model loading
      if (response.data.error) {
        if (response.data.estimated_time) {
          throw new Error(`Model loading: ${response.data.estimated_time}s`);
        }
        continue; // Try next model
      }
      
      const content = response.data[0]?.generated_text || response.data.generated_text || '';
      if (content) {
        return parseAndValidateResponse(content, model);
      }
    } catch (error) {
      if (error.response?.status === 503) {
        // Model is loading
        continue;
      }
      console.warn(`Direct API model ${model} failed:`, error.message);
      continue;
    }
  }
  
  throw new Error('All Hugging Face models failed');
}

function parseAndValidateResponse(content, modelName) {
  // Step 4: Parse & validate AI response (must be valid JSON)
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  
  if (!jsonMatch) {
    // If no JSON found, create a structured response from the text
    const sentimentMatch = content.match(/(bullish|bearish|neutral)/i);
    const sentiment = sentimentMatch ? 
      sentimentMatch[0].charAt(0).toUpperCase() + sentimentMatch[0].slice(1).toLowerCase() : 
      'Neutral';
    
    return {
      reasoning: content.substring(0, 200).trim() || 'Analysis generated by Hugging Face model.',
      sentiment: (sentiment === 'Bullish' || sentiment === 'Bearish') ? sentiment : 'Neutral',
      provider: 'huggingface',
      model: modelName
    };
  }

  const jsonStr = jsonMatch[0];
  let insight;
  try {
    insight = JSON.parse(jsonStr);
  } catch (parseError) {
    // If JSON parsing fails, extract sentiment from text
    const sentimentMatch = content.match(/(bullish|bearish|neutral)/i);
    const sentiment = sentimentMatch ? 
      sentimentMatch[0].charAt(0).toUpperCase() + sentimentMatch[0].slice(1).toLowerCase() : 
      'Neutral';
    
    return {
      reasoning: content.substring(0, 200).trim() || 'Analysis generated by Hugging Face model.',
      sentiment: (sentiment === 'Bullish' || sentiment === 'Bearish') ? sentiment : 'Neutral',
      provider: 'huggingface',
      model: modelName
    };
  }

  // Validate required fields
  if (!insight.reasoning || !insight.sentiment) {
    const sentimentMatch = content.match(/(bullish|bearish|neutral)/i);
    const sentiment = sentimentMatch ? 
      sentimentMatch[0].charAt(0).toUpperCase() + sentimentMatch[0].slice(1).toLowerCase() : 
      'Neutral';
    
    return {
      reasoning: insight.reasoning || content.substring(0, 200).trim() || 'Analysis generated.',
      sentiment: insight.sentiment || ((sentiment === 'Bullish' || sentiment === 'Bearish') ? sentiment : 'Neutral'),
      provider: 'huggingface',
      model: modelName
    };
  }

  // Validate sentiment value
  const validSentiments = ['Bullish', 'Bearish', 'Neutral'];
  if (!validSentiments.includes(insight.sentiment)) {
    insight.sentiment = 'Neutral';
  }

  return {
    reasoning: insight.reasoning,
    sentiment: insight.sentiment,
    provider: 'huggingface',
    model: modelName
  };
}

// Step 2: Build structured prompt
function buildPrompt(tokenData) {
  const { name, symbol, market_data, historical_data } = tokenData;
  
  let prompt = `Analyze the following cryptocurrency token and provide insights:

Token: ${name} (${symbol.toUpperCase()})
Current Price: $${market_data.current_price_usd}
Market Cap: $${(market_data.market_cap_usd / 1e9).toFixed(2)}B
24h Volume: $${(market_data.total_volume_usd / 1e6).toFixed(2)}M
24h Change: ${market_data.price_change_percentage_24h}%
7d Change: ${market_data.price_change_percentage_7d}%
30d Change: ${market_data.price_change_percentage_30d}%`;

  if (historical_data) {
    prompt += `\n\nHistorical data available for analysis.`;
  }

  prompt += `\n\nRespond with valid JSON only:
{
  "reasoning": "Brief analysis of the token's market position and trends",
  "sentiment": "Bullish" | "Bearish" | "Neutral"
}`;

  return prompt;
}

function getMockResponse(tokenData) {
  const { market_data } = tokenData;
  const change24h = market_data.price_change_percentage_24h;
  const sentiment = change24h > 5 ? 'Bullish' : change24h < -5 ? 'Bearish' : 'Neutral';

  return {
    reasoning: `${tokenData.name} trading at $${market_data.current_price_usd} with ${change24h > 0 ? 'positive' : 'negative'} 24h change of ${change24h}%.`,
    sentiment,
    provider: 'mock',
    model: 'mock'
  };
}

module.exports = { generateInsight };

