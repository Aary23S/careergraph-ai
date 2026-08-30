'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('resume_ai_enrichments', 'contact_info', {
      type: Sequelize.JSON,
      allowNull: true
    });
    await queryInterface.addColumn('resume_ai_enrichments', 'canonical_skills', {
      type: Sequelize.JSON,
      allowNull: true
    });
    await queryInterface.addColumn('resume_ai_enrichments', 'total_experience_years', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
    await queryInterface.addColumn('resume_ai_enrichments', 'needs_review', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('resume_ai_enrichments', 'needs_review');
    await queryInterface.removeColumn('resume_ai_enrichments', 'total_experience_years');
    await queryInterface.removeColumn('resume_ai_enrichments', 'canonical_skills');
    await queryInterface.removeColumn('resume_ai_enrichments', 'contact_info');
  }
};
