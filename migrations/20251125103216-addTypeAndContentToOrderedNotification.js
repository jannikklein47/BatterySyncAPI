"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    await queryInterface.addColumn("OrderedNotifications", "type", {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: "CHARGEREMINDER",
    });
    await queryInterface.addColumn("OrderedNotifications", "content", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.removeColumn("OrderedNotifications", "type");
    await queryInterface.removeColumn("OrderedNotifications", "content");
  },
};
