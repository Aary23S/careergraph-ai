'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addIndex('connections', ['connected_date']);
    await queryInterface.addIndex('connections', ['next_follow_up_date']);
    await queryInterface.addIndex('connections', ['last_contacted_date']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('connections', ['connected_date']);
    await queryInterface.removeIndex('connections', ['next_follow_up_date']);
    await queryInterface.removeIndex('connections', ['last_contacted_date']);
  },
};
