'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Extend jobs table
    await queryInterface.addColumn('jobs', 'source_url', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('jobs', 'external_job_id', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('jobs', 'source_metadata', {
      type: Sequelize.JSON,
      allowNull: true
    });
    await queryInterface.addColumn('jobs', 'fetched_at', {
      type: Sequelize.DATE,
      allowNull: true
    });
    await queryInterface.addColumn('jobs', 'provider', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('jobs', 'normalized_company', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('jobs', 'normalized_title', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('jobs', 'normalized_location', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('jobs', 'normalized_skills', {
      type: Sequelize.JSON,
      allowNull: true
    });
    await queryInterface.addColumn('jobs', 'remote_type', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('jobs', 'experience_level', {
      type: Sequelize.STRING,
      allowNull: true
    });

    // 2. Extend applications table
    await queryInterface.addColumn('applications', 'resume_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'resumes',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
    await queryInterface.addColumn('applications', 'cover_letter', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    await queryInterface.addColumn('applications', 'referral_connection_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'connections',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
    await queryInterface.addColumn('applications', 'notes', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    await queryInterface.addColumn('applications', 'next_follow_up_date', {
      type: Sequelize.DATEONLY,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    // 1. Revert jobs table
    await queryInterface.removeColumn('jobs', 'source_url');
    await queryInterface.removeColumn('jobs', 'external_job_id');
    await queryInterface.removeColumn('jobs', 'source_metadata');
    await queryInterface.removeColumn('jobs', 'fetched_at');
    await queryInterface.removeColumn('jobs', 'provider');
    await queryInterface.removeColumn('jobs', 'normalized_company');
    await queryInterface.removeColumn('jobs', 'normalized_title');
    await queryInterface.removeColumn('jobs', 'normalized_location');
    await queryInterface.removeColumn('jobs', 'normalized_skills');
    await queryInterface.removeColumn('jobs', 'remote_type');
    await queryInterface.removeColumn('jobs', 'experience_level');

    // 2. Revert applications table
    await queryInterface.removeColumn('applications', 'resume_id');
    await queryInterface.removeColumn('applications', 'cover_letter');
    await queryInterface.removeColumn('applications', 'referral_connection_id');
    await queryInterface.removeColumn('applications', 'notes');
    await queryInterface.removeColumn('applications', 'next_follow_up_date');
  }
};
