'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('connections', 'normalized_company', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('connections', 'normalized_position', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('connections', 'seniority_level', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('connections', 'role_category', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('connections', 'priority', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('connections', 'connection_score', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('connections', 'profile_completeness', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('connections', 'last_enriched_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // Add indexes for efficient filtering
    await queryInterface.addIndex('connections', ['normalized_company']);
    await queryInterface.addIndex('connections', ['normalized_position']);
    await queryInterface.addIndex('connections', ['seniority_level']);
    await queryInterface.addIndex('connections', ['role_category']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('connections', ['normalized_company']);
    await queryInterface.removeIndex('connections', ['normalized_position']);
    await queryInterface.removeIndex('connections', ['seniority_level']);
    await queryInterface.removeIndex('connections', ['role_category']);

    await queryInterface.removeColumn('connections', 'normalized_company');
    await queryInterface.removeColumn('connections', 'normalized_position');
    await queryInterface.removeColumn('connections', 'seniority_level');
    await queryInterface.removeColumn('connections', 'role_category');
    await queryInterface.removeColumn('connections', 'priority');
    await queryInterface.removeColumn('connections', 'connection_score');
    await queryInterface.removeColumn('connections', 'profile_completeness');
    await queryInterface.removeColumn('connections', 'last_enriched_at');
  },
};
