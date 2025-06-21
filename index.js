
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Helper function to parse options from message
function parseOptions(message) {
  const options = {
    imagine: message.includes('--imagine'),
    think: message.includes('--think'),
    web: message.includes('--web'),
    deep: message.includes('--deep'),
    memory: message.includes('--memory')
  };
  
  // Remove options from message to get clean prompt
  const prompt = message.replace(/--\w+/g, '').trim();
  
  return { options, prompt };
}

// Helper function to get cookies from Blackbox AI
async function getCookies() {
  try {
    const response = await axios.head('https://www.blackbox.ai/');
    const cookies = response.headers['set-cookie'];
    return cookies ? cookies.join('; ') : '';
  } catch (error) {
    throw new Error('Failed to get cookies');
  }
}

// Helper function to make chat request
async function makeChatRequest(prompt, options, cookies) {
  const { imagine, think, web, deep, memory } = options;
  
  // Override configure - if image option is used with other options, disable others
  const useImageParameter = imagine;
  const exceptImageParameter = think || web || deep;
  
  let finalThink = think;
  let finalWeb = web;
  let finalDeep = deep;
  
  if (exceptImageParameter && useImageParameter) {
    finalThink = false;
    finalWeb = false;
    finalDeep = false;
  }

  const bodyData = {
    messages: [{
      id: null,
      content: prompt,
      role: "user"
    }],
    agentMode: {},
    id: null,
    previewToken: null,
    userId: null,
    codeModelMode: true,
    trendingAgentMode: {},
    isMicMode: false,
    userSystemPrompt: null,
    maxTokens: 1024,
    playgroundTopP: null,
    playgroundTemperature: null,
    isChromeExt: false,
    githubToken: "",
    clickedAnswer2: false,
    clickedAnswer3: false,
    clickedForceWebSearch: false,
    visitFromDelta: false,
    isMemoryEnabled: false,
    mobileClient: false,
    userSelectedModel: null,
    validated: "00f37b34-a166-4efb-bce5-1312d87f2f94",
    imageGenerationMode: imagine,
    webSearchModePrompt: finalWeb,
    deepSearchMode: finalDeep,
    domains: null,
    vscodeClient: false,
    codeInterpreterMode: false,
    customProfile: "",
    session: {
      user: { name: "", email: "", image: "", id: "" },
      expires: ""
    },
    isPremium: false,
    subscriptionCache: null,
    beastMode: false,
    reasoningMode: finalThink
  };

  const headers = {
    'Cookie': cookies,
    'Origin': 'https://www.blackbox.ai',
    'Referer': 'https://www.blackbox.ai',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    'Content-Type': 'application/json'
  };

  const response = await axios.post('https://www.blackbox.ai/api/chat', bodyData, { headers });
  return response.data;
}

// Helper function to process response
function processResponse(responseData) {
  const responseText = responseData.toString();
  
  // Check for quick response (web search results)
  const quickMatch = responseText.match(/\$~~~\$(.*)/s);
  const quickResult = quickMatch ? quickMatch[1] : '';
  
  // Check for thinking process
  const thinkMatch = responseText.match(/<think>(.*?)<\/think>/s);
  const thinkResult = thinkMatch ? thinkMatch[1] : '';
  
  // Get final result
  let finalResult;
  if (thinkResult) {
    finalResult = responseText.split('</think>')[1] || '';
  } else if (quickResult) {
    finalResult = responseText.split('$~~~$')[2] || '';
  } else {
    finalResult = responseText;
  }
  
  return {
    response: finalResult.trim(),
    thinking: thinkResult.trim(),
    webSearch: quickResult.trim(),
    raw: responseText
  };
}

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    const { options, prompt } = parseOptions(message);
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    
    // Get cookies
    const cookies = await getCookies();
    
    // Make chat request
    const responseData = await makeChatRequest(prompt, options, cookies);
    
    // Process response
    const processedResponse = processResponse(responseData);
    
    res.json({
      success: true,
      prompt,
      options,
      ...processedResponse
    });
    
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Image generation endpoint
app.get('/api/generate-image', async (req, res) => {
  try {
    const { 
      prompt, 
      width = 1024, 
      height = 1024, 
      model = 'midjourney', 
      nologo = true, 
      private = false, 
      enhance = true, 
      seed 
    } = req.query;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Build the Pollinations AI URL
    const baseUrl = 'https://image.pollinations.ai/prompt/';
    const encodedPrompt = encodeURIComponent(prompt);
    
    let imageUrl = `${baseUrl}${encodedPrompt}?width=${width}&height=${height}&model=${model}&nologo=${nologo}&private=${private}&enhance=${enhance}`;
    
    if (seed) {
      imageUrl += `&seed=${seed}`;
    }

    res.json({
      image_url: imageUrl,
      prompt: prompt,
      parameters: {
        width,
        height,
        model,
        nologo,
        private,
        enhance,
        seed
      }
    });

  } catch (error) {
    console.error('Error generating image:', error);
    res.status(500).json({ error: 'Failed to generate image' });
  }
});

// Example endpoint that matches your format
app.get('/api/cat-example', (req, res) => {
  const imageUrl = 'https://image.pollinations.ai/prompt/cat?width=1024&height=1024&model=midjourney&nologo=true&private=false&enhance=true&seed=563910';
  
  res.json({
    image_url: imageUrl
  });
});

// API documentation endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    title: 'Blackbox AI Chat & Image Generation API',
    endpoints: {
      'POST /api/chat': {
        description: 'Send a message to Blackbox AI',
        body: {
          message: 'string - The message with optional flags (--think, --web, --deep, --imagine, --memory)'
        },
        example: {
          message: '--think --web What is the capital of France?'
        }
      },
      'GET /api/generate-image': {
        description: 'Generate images using Pollinations AI',
        query: {
          prompt: 'string - The image description (required)',
          width: 'number - Image width (default: 1024)',
          height: 'number - Image height (default: 1024)',
          model: 'string - AI model (default: midjourney)',
          nologo: 'boolean - Remove logo (default: true)',
          private: 'boolean - Private generation (default: false)',
          enhance: 'boolean - Enhance image (default: true)',
          seed: 'number - Random seed (optional)'
        },
        example: '/api/generate-image?prompt=beautiful%20landscape&width=512&height=512'
      },
      'GET /api/cat-example': {
        description: 'Example cat image generation'
      },
      'GET /api/health': {
        description: 'Health check endpoint'
      }
    },
    chat_options: {
      '--think': 'Think before responding',
      '--web': 'Search the web',
      '--deep': 'For complex tasks',
      '--imagine': 'Generate images',
      '--memory': 'Memorize chat (experimental)'
    }
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API Documentation: http://localhost:${PORT}/api/docs`);
});
