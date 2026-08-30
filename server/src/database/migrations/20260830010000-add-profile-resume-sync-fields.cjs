'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('profiles', 'professional_title', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('profiles', 'career_level', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('profiles', 'resume_confidence', {
      type: Sequelize.FLOAT,
      allowNull: true
    });
    await queryInterface.addColumn('profiles', 'links', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: {}
    });
    await queryInterface.addColumn('profiles', 'resume_sync_meta', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: {}
    });
    await queryInterface.addColumn('profiles', 'last_resume_synced_at', {
      type: Sequelize.DATE,
      allowNull: true
    });
    await queryInterface.addColumn('profiles', 'synced_resume_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'resumes', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('profiles', 'synced_resume_id');
    await queryInterface.removeColumn('profiles', 'last_resume_synced_at');
    await queryInterface.removeColumn('profiles', 'resume_sync_meta');
    await queryInterface.removeColumn('profiles', 'links');
    await queryInterface.removeColumn('profiles', 'resume_confidence');
    await queryInterface.removeColumn('profiles', 'career_level');
    await queryInterface.removeColumn('profiles', 'professional_title');
  }
};
