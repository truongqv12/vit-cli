/**
 * Cấu hình semantic-release cho Vit CLI (publish npm trên branch main).
 * Bám theo claudekit-cli: releaseRules + sections changelog rõ ràng.
 * Build dist/ qua `prepack` của @semantic-release/npm khi đóng gói.
 */
module.exports = {
  branches: ['main'],
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        preset: 'conventionalcommits',
        releaseRules: [
          { type: 'feat', release: 'minor' },
          { type: 'fix', release: 'patch' },
          { type: 'perf', release: 'patch' },
          { type: 'refactor', release: 'patch' },
          { type: 'docs', release: 'patch' },
        ],
      },
    ],
    [
      '@semantic-release/release-notes-generator',
      {
        preset: 'conventionalcommits',
        presetConfig: {
          types: [
            { type: 'feat', section: '🚀 Features' },
            { type: 'fix', section: '🐞 Bug Fixes' },
            { type: 'perf', section: '⚡ Performance Improvements' },
            { type: 'refactor', section: '♻️ Code Refactoring' },
            { type: 'docs', section: '📚 Documentation' },
          ],
        },
      },
    ],
    ['@semantic-release/changelog', { changelogFile: 'CHANGELOG.md' }],
    ['@semantic-release/npm', { npmPublish: true }],
    [
      '@semantic-release/git',
      {
        assets: ['package.json', 'CHANGELOG.md'],
        message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
      },
    ],
    '@semantic-release/github',
  ],
};
