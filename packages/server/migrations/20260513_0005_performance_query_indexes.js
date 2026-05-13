export const id = '20260513_performance_query_indexes';

export async function up({ queryInterface, transaction }) {
  const options = { transaction };

  await queryInterface.addIndex('performance_stats', ['run_id', 'stat_group', 'stat_name'], {
    ...options,
    name: 'performance_stats_run_group_name_idx',
  });

  await queryInterface.addIndex('performance_stats', ['stat_group', 'stat_name', 'created_at'], {
    ...options,
    name: 'performance_stats_group_name_created_at_idx',
  });
}

export async function down({ queryInterface, transaction }) {
  const options = { transaction };

  await queryInterface.removeIndex('performance_stats', 'performance_stats_run_group_name_idx', options);
  await queryInterface.removeIndex('performance_stats', 'performance_stats_group_name_created_at_idx', options);
}
