// src/cli.mts
import { codeReviewTool } from './code-review-tool.mjs';
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

// 获取变更文件列表（兼容首次提交）
function getChangedFiles(): string[] {
  try {
    // 获取第一个提交哈希
    const firstCommit = execSync('git rev-list --max-parents=0 HEAD')
      .toString()
      .trim();
    const currentCommit = execSync('git rev-parse HEAD')
      .toString()
      .trim();

    // 判断是否为首次提交
    const diffTarget = firstCommit === currentCommit
      ? '4b825dc642cb6eb9a060e54bf8d69288fbee4904' // Git 的空树哈希
      : 'HEAD^';

    const output = execSync(`git diff --name-only ${diffTarget} HEAD`)
      .toString()
      .split('\n')
      .filter(f => ['.ts', '.tsx', '.js'].some(ext => f.endsWith(ext)));

    return output;
  } catch (error: any) {
    console.log('获取变更文件失败:', error.message);
    return [];
  }
}

// 生成审查报告
async function runReview() {
  const files = getChangedFiles();

  if (files.length === 0) {
    console.log('🚨 没有需要审查的代码变更');
    return;
  }

  const allResults = [];

  for (const file of files) {
    try {
      const code = readFileSync(file, 'utf-8');
      const result = await codeReviewTool.execute({
        input: {
          code,
          fileType: file.split('.').pop() || 'ts'
        }
      });

      console.log(`📄 文件 ${file} 审查完成`);
      allResults.push(result);

      // 保存详细结果
      writeFileSync(
        `review-${Date.now()}.json`,
        JSON.stringify(result, null, 2)
      );
    } catch (error: any) {
      console.error(`❌ ${file} 审查失败:`, error.message);
    }
  }

  // 总结报告
  console.log('\n=== 审查总结 ===');
  console.log(`共审查 ${files.length} 个文件`);
  console.log(`发现 ${allResults.reduce((sum, r) => sum + r.issues.length, 0)} 个问题`);

  let totalErrors = 0;
  for (const result of allResults) {
    console.log(`result.issues=`, result.issues);
    totalErrors += result.issues.filter(i => i.severity === '高' || i.severity === '中').length;
  }

  // 根据高危问题数量设置退出码
  if (totalErrors > 0) {
    console.error(`发现 ${totalErrors} 个高危问题，请修复后重试`);
    process.exit(1); // 非零退出码使工作流失败
  }
}

runReview().catch(console.error);