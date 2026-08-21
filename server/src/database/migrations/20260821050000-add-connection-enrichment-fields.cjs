'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('connections', 'headline', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('connections', 'skills', {
      type: Sequelize.JSON,
      allowNull: true
    });
    await queryInterface.addColumn('connections', 'external_links', {
      type: Sequelize.JSON,
      allowNull: true
    });
    await queryInterface.addColumn('connections', 'profile_summary', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    await queryInterface.addColumn('connections', 'data_sources', {
      type: Sequelize.JSON,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('connections', 'headline');
    await queryInterface.removeColumn('connections', 'skills');
    await queryInterface.removeColumn('connections', 'external_links');
    await queryInterface.removeColumn('connections', 'profile_summary');
    await queryInterface.removeColumn('connections', 'data_sources');
  }
};
