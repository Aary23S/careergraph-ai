'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('ai_audit_logs', 'correlation_id', {
      type: Sequelize.UUID,
      allowNull: true
    });
    await queryInterface.addIndex('ai_audit_logs', ['correlation_id']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('ai_audit_logs', 'correlation_id');
  }
};
