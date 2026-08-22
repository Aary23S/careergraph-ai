'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('connections', 'languages', {
      type: Sequelize.JSON,
      allowNull: true
    });
    await queryInterface.addColumn('connections', 'certifications', {
      type: Sequelize.JSON,
      allowNull: true
    });
    await queryInterface.addColumn('connections', 'projects', {
      type: Sequelize.JSON,
      allowNull: true
    });
    await queryInterface.addColumn('connections', 'experience', {
      type: Sequelize.JSON,
      allowNull: true
    });
    await queryInterface.addColumn('connections', 'education', {
      type: Sequelize.JSON,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('connections', 'languages');
    await queryInterface.removeColumn('connections', 'certifications');
    await queryInterface.removeColumn('connections', 'projects');
    await queryInterface.removeColumn('connections', 'experience');
    await queryInterface.removeColumn('connections', 'education');
  }
};
