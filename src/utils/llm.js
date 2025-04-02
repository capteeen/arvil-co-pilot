const { OpenAI } = require('openai');
const { Anthropic } = require('@anthropic-ai/sdk');
const { DeepSeek } = require('@deepseek/sdk');

class LLMProvider {
  constructor(config) {
    this.config = config;
    this.setupProviders();
  }

  setupProviders() {
    // Initialize providers based on available API keys
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }

    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
      });
    }

    if (process.env.DEEPSEEK_API_KEY) {
      this.deepseek = new DeepSeek({
        apiKey: process.env.DEEPSEEK_API_KEY
      });
    }
  }

  async chat(messages, options = {}) {
    const { model = 'gpt-4', temperature = 0.7 } = options;

    // Select provider based on model
    if (model.startsWith('claude')) {
      return this.anthropicChat(messages, model, temperature);
    } else if (model.startsWith('deepseek')) {
      return this.deepseekChat(messages, model, temperature);
    } else {
      return this.openaiChat(messages, model, temperature);
    }
  }

  async openaiChat(messages, model, temperature) {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await this.openai.chat.completions.create({
      model,
      messages,
      temperature
    });

    return response.choices[0].message.content;
  }

  async anthropicChat(messages, model, temperature) {
    if (!this.anthropic) {
      throw new Error('Anthropic API key not configured');
    }

    // Convert messages to Anthropic format
    const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n');

    const response = await this.anthropic.messages.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature
    });

    return response.content;
  }

  async deepseekChat(messages, model, temperature) {
    if (!this.deepseek) {
      throw new Error('DeepSeek API key not configured');
    }

    const response = await this.deepseek.chat.completions.create({
      model,
      messages,
      temperature
    });

    return response.choices[0].message.content;
  }
}

module.exports = LLMProvider; 