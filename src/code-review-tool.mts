import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import axios from 'axios';

interface CodeReviewIssue {
  type: '代码风格' | '性能问题' | '潜在错误' | '安全风险';
  description: string;
  line: number;
  severity: '低' | '中' | '高';
  suggestion: string;
}

interface CodeReviewResult {
  issues: CodeReviewIssue[];
  summary: string;
  score?: number;
}

export const codeReviewTool = createTool({
  id: 'code-review',
  description: 'Perform automated code review using DeepSeek API',
  inputSchema: z.object({
    code: z.string().describe('需要审查的代码内容'),
    fileType: z.string().describe('文件类型 (e.g. ts, tsx, js)')
  }),
  outputSchema: z.object({
    issues: z.array(
      z.object({
        type: z.enum(['代码风格', '性能问题', '潜在错误', '安全风险']),
        description: z.string(),
        line: z.number(),
        severity: z.enum(['低', '中', '高']),
        suggestion: z.string()
      })
    ),
    summary: z.string(),
    score: z.number().optional()
  }),
  execute: async ({ input }) => {
    try {
      const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
      const response = await axios.post(
        'https://api.deepseek.com/v1/chat/completions',
        {
          model: "deepseek-coder",
          messages: [{
            role: "user",
            content: `严格审查以下${input.fileType}代码：
${input.code}

请按照以下格式返回JSON结果：
{
  "issues": [{
    "type": "代码风格/性能问题/潜在错误/安全风险",
    "description": "问题描述",
    "line": 行号,
    "severity": "低/中/高",
    "suggestion": "优化建议"
  }],
  "summary": "总体评估摘要",
  "score": 代码健康度评分(1-100)
}`
          }],
          temperature: 0.2,
          response_format: { type: "json_object" }
        },
        {
          headers: {
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const result = JSON.parse(response.data.choices[0].message.content);
      return {
        issues: result.issues.map((issue: any) => ({
          ...issue,
          line: Number(issue.line) || 0
        })),
        summary: result.summary,
        score: result.score
      };
    } catch (error) {
      console.error('Code review failed:', error);
      return {
        issues: [],
        summary: '代码审查服务暂不可用',
        score: 0
      };
    }
  }
});