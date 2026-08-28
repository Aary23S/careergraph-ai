'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('profiles', 'education', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: []
    });
    await queryInterface.addColumn('profiles', 'certifications', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: []
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('profiles', 'education');
    await queryInterface.removeColumn('profiles', 'certifications');
  }
};
