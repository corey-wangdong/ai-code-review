// src/code-review-tool.mts
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import axios from 'axios';

export const codeReviewTool = createTool({
  id: 'code-review',
  description: 'DeepSeek 代码审查工具',
  inputSchema: z.object({
    code: z.string().describe('需要审查的代码内容'),
    fileType: z.enum(['ts', 'tsx', 'js']).describe('文件类型')
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
    score: z.number().min(0).max(100)
  }),
  execute: async ({ input }: any) => {
    try {
      const response = await axios.post(
        'https://api.deepseek.com/v1/chat/completions',
        {
          model: "deepseek-coder",
          messages: [{
            role: "user",
            content: `执行严格代码审查（${input.fileType}）：
${input.code}

输出要求：
- 按行号指出问题
- 按严重性排序
- JSON格式：
{
  "issues": [{
    "type": "问题类型",
    "description": "具体描述",
    "line": 行号,
    "severity": "严重等级",
    "suggestion": "修复建议"
  }],
  "summary": "审查摘要",
  "score": 健康评分
}`
          }],
          temperature: 0.2,
          response_format: { type: "json_object" }
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const rawData = JSON.parse(response.data.choices[0].message.content);

      // 数据清洗
      return {
        issues: rawData.issues.map(issue => ({
          ...issue,
          line: Number(issue.line) || 0
        })),
        summary: rawData.summary || '未提供摘要',
        score: Math.min(Math.max(rawData.score || 80, 0), 100)
      };
    } catch (error) {
      console.error('DeepSeek API 错误:', error.response?.data || error.message);
      return {
        issues: [],
        summary: '审查服务暂时不可用',
        score: 0
      };
    }
  }
});