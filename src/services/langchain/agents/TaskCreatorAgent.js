const BaseAgent = require("../../../agents/baseAgent");
const promptManager = require("../prompts");

class TaskCreatorAgent extends BaseAgent {
  constructor() {
    super("TaskCreatorAgent");
  }

  async execute(insightData) {
    this.logger.info("TaskCreatorAgent creating optimization tasks...");
    // Prepare prompt for LLM
    const prompt = promptManager.getTemplate("optimization");
    const input = {
      insights: insightData.insights,
    };
    // Call LLM for tasks
    let tasks = [];
    let aiGenerated = true;
    try {
      if (this.llm && prompt) {
        const chain = prompt.pipe(this.llm);
        const result = await chain.invoke({ analysis: JSON.stringify(input) });
        // Try to parse as JSON, fallback to string
        try {
          let parsedTasks;
          if (typeof result === "string") {
            parsedTasks = JSON.parse(result);
          } else if (result && typeof result.content === "string") {
            parsedTasks = JSON.parse(result.content);
          } else if (result && typeof result.text === "string") {
            parsedTasks = JSON.parse(result.text);
          } else {
            parsedTasks = result;
          }
          // Format tasks for database
          tasks = Array.isArray(parsedTasks)
            ? parsedTasks.map((task) => ({
                type: task.type || "general",
                priority: task.priority || "medium",
                description:
                  task.recommendation ||
                  task.description ||
                  "No description provided",
                impact: task.impact || "medium",
                difficulty: task.difficulty || "medium",
                action_items: task.action_items || [],
              }))
            : [
                {
                  type: "general",
                  priority: "medium",
                  description: "Failed to parse task format",
                  impact: "low",
                  difficulty: "medium",
                  action_items: [],
                },
              ];
        } catch (e) {
          tasks = [
            {
              type: "general",
              priority: "medium",
              description: result,
              impact: "low",
              difficulty: "medium",
              action_items: [],
            },
          ];
        }
      } else {
        tasks = [
          {
            type: "general",
            priority: "medium",
            description: "LLM or prompt not available",
            impact: "low",
            action_items: [],
          },
        ];
        aiGenerated = false;
      }
    } catch (err) {
      this.logger.error("LLM call failed:", err);
      tasks = [
        {
          type: "general",
          priority: "medium",
          description: "Failed to generate tasks via LLM",
          impact: "low",
          action_items: [],
        },
      ];
      aiGenerated = false;
    }
    return {
      tasks,
      aiGenerated,
    };
  }
}

module.exports = TaskCreatorAgent;
