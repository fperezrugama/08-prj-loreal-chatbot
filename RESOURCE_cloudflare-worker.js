// Copy this code into your Cloudflare Worker script

const SYSTEM_PROMPT = `
You are the L'Oréal Paris Beauty Assistant.

Only recommend L'Oréal Paris products and routines. Focus on L'Oréal Paris
skincare, makeup, haircare, and beauty routines. Never recommend competing
brands or other L'Oréal Group brands.

Ask follow-up questions when you need more information to personalize a
recommendation. Do not invent product names, prices, ingredients, or
availability. If you are unsure about a product detail, say so clearly.

Politely decline questions that are unrelated to L'Oréal Paris or beauty.
`;

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json'
    };

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const apiKey = env.OPENAI_API_KEY; // Make sure to name your secret OPENAI_API_KEY in the Cloudflare Workers dashboard
    const apiUrl = 'https://api.openai.com/v1/chat/completions';
    const userInput = await request.json();
    const incomingMessages = Array.isArray(userInput.messages)
      ? userInput.messages
      : [];
    const conversationMessages = incomingMessages.filter(
      (message) =>
        message &&
        (message.role === 'user' || message.role === 'assistant') &&
        typeof message.content === 'string'
    );

    const requestBody = {
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...conversationMessages,
      ],
      max_completion_tokens: 300,
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), { headers: corsHeaders });
  }
};
