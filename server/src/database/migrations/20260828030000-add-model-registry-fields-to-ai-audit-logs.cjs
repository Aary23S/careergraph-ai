'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Additive/nullable only -- existing rows and existing callers that
    // don't pass these fields are unaffected. The existing `model` column
    // already carries the model name string; model_version and
    // model_registry_id are new so a specific registered version can be
    // traced back to `model_registry` when the registry is enabled.
    await queryInterface.addColumn('ai_audit_logs', 'model_registry_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'model_registry',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await queryInterface.addColumn('ai_audit_logs', 'model_version', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('ai_audit_logs', 'model_version');
    await queryInterface.removeColumn('ai_audit_logs', 'model_registry_id');
  }
};
