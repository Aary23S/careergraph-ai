'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Jobs
    await queryInterface.addIndex('jobs', ['user_id', 'created_at']);
    await queryInterface.addIndex('jobs', ['user_id', 'status']);
    await queryInterface.addIndex('jobs', ['user_id', 'is_archived']);

    // Connections
    await queryInterface.addIndex('connections', ['user_id', 'connected_date']);
    await queryInterface.addIndex('connections', ['user_id', 'next_follow_up_date']);

    // Applications
    await queryInterface.addIndex('applications', ['user_id', 'status']);

    // Job Ingestion Events
    await queryInterface.addIndex('job_ingestion_events', ['user_id', 'status', 'processed_at']);

    // Incoming Jobs
    await queryInterface.addIndex('incoming_jobs', ['user_id', 'source', 'received_at']);
    await queryInterface.addIndex('incoming_jobs', ['user_id', 'status']);

    // Job Deduplication Logs
    await queryInterface.addIndex('job_deduplication_logs', ['user_id', 'logged_at']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('jobs', ['user_id', 'created_at']);
    await queryInterface.removeIndex('jobs', ['user_id', 'status']);
    await queryInterface.removeIndex('jobs', ['user_id', 'is_archived']);

    await queryInterface.removeIndex('connections', ['user_id', 'connected_date']);
    await queryInterface.removeIndex('connections', ['user_id', 'next_follow_up_date']);

    await queryInterface.removeIndex('applications', ['user_id', 'status']);

    await queryInterface.removeIndex('job_ingestion_events', ['user_id', 'status', 'processed_at']);

    await queryInterface.removeIndex('incoming_jobs', ['user_id', 'source', 'received_at']);
    await queryInterface.removeIndex('incoming_jobs', ['user_id', 'status']);

    await queryInterface.removeIndex('job_deduplication_logs', ['user_id', 'logged_at']);
  },
};
