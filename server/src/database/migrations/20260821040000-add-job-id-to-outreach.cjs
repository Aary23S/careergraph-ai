'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('outreach', 'job_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'jobs',
        key: 'id'
      },
      onDelete: 'CASCADE'
    });
    await queryInterface.addIndex('outreach', ['job_id']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('outreach', ['job_id']);
    await queryInterface.removeColumn('outreach', 'job_id');
  }
};
