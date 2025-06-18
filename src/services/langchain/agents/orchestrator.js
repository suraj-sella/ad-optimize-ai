const langchainConfig = require('../../langchain/config');
const DataAnalyzerAgent = require('./DataAnalyzerAgent');
const InsightGeneratorAgent = require('./InsightGeneratorAgent');
const TaskCreatorAgent = require('./TaskCreatorAgent');

/**
 * Orchestrate the multi-agent pipeline
 * @param {Object} csvData - The processed CSV data/metrics
 * @returns {Object} - Combined output from all agents
 */
async function runAgentPipeline(csvData) {
  try {
    // Ensure LangChain config is initialized before using agents
    await langchainConfig.initialize();

    // Now create agents (after LLM is ready)
    const dataAnalyzer = new DataAnalyzerAgent();
    const insightGenerator = new InsightGeneratorAgent();
    const taskCreator = new TaskCreatorAgent();

    // 1. Data analysis
    const analysisResult = await dataAnalyzer.execute(csvData);

    // 2. Insight generation
    const insightResult = await insightGenerator.execute(analysisResult);

    // 3. Task creation
    const taskResult = await taskCreator.execute(insightResult);

    // Determine if AI was used for both insights and tasks
    const aiGenerated = (insightResult.aiGenerated !== false) && (taskResult.aiGenerated !== false);

    return {
      analysis: analysisResult,
      insights: insightResult,
      tasks: taskResult,
      aiGenerated
    };
  } catch (error) {
    // Handle errors gracefully
    return { error: error.message, aiGenerated: false };
  }
}

module.exports = { runAgentPipeline }; 