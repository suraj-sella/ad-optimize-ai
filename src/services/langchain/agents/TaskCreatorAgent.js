const BaseAgent = require('../../../agents/baseAgent');
const promptManager = require('../prompts');

class TaskCreatorAgent extends BaseAgent {
  constructor() {
    super('TaskCreatorAgent');
  }

  async execute(insightData) {
    this.logger.info('TaskCreatorAgent creating optimization tasks...');
    // Prepare prompt for LLM
    const prompt = promptManager.getTemplate('optimization');
    const input = {
      insights: insightData.insights
    };
    // Call LLM for tasks
    let tasks = [];
    try {
      if (this.llm && prompt) {
        const chain = prompt.pipe(this.llm);
        const result = await chain.invoke({ analysis: JSON.stringify(input) });
        // Try to parse as JSON, fallback to string
        try {
          tasks = typeof result === 'string' ? JSON.parse(result) : result;
        } catch (e) {
          tasks = [result];
        }
      } else {
        tasks = ['LLM or prompt not available'];
      }
    } catch (err) {
      this.logger.error('LLM call failed:', err);
      tasks = ['Failed to generate tasks via LLM'];
    }
    return {
      tasks,
      raw: insightData
    };
  }
}

module.exports = TaskCreatorAgent; 