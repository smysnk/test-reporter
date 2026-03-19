export const id = '20260319_benchmark_indexes';

export async function up({ queryInterface, transaction }) {
  const options = { transaction };

  await queryInterface.addIndex('performance_stats', ['stat_group', 'stat_name'], {
    ...options,
    name: 'performance_stats_stat_group_stat_name_idx',
  });

  await queryInterface.addIndex('runs', ['project_id', 'completed_at'], {
    ...options,
    name: 'runs_project_id_completed_at_idx',
  });
}

export async function down({ queryInterface, transaction }) {
  const options = { transaction };

  await queryInterface.removeIndex('performance_stats', 'performance_stats_stat_group_stat_name_idx', options);
  await queryInterface.removeIndex('runs', 'runs_project_id_completed_at_idx', options);
}
