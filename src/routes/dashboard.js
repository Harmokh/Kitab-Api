// routes/dashboard.js
const express = require("express");
const { Op, fn, col, literal, Sequelize } = require("sequelize");
const { success, error } = require("../utils/response");
const dashboardRouter = express.Router();

module.exports = (models) => {
  dashboardRouter.get("/dashboard/getdata", async (req, res) => {
    try {
      // 1️⃣ Total Active Users
      const totalActiveUsers = await models.User.count({
        where: { isActive: true, isDeleted: false },
      });

      // 2️⃣ User Session Trends (last 7 days)
      const sessionData = await models.UserSession.findAll({
        attributes: [
          [fn("TO_CHAR", col("LoginTime"), "Dy"), "day"],
          [fn("COUNT", col("UserSessionId")), "count"],
        ],
        where: {
          LoginTime: {
            [Op.gte]: literal("NOW() - INTERVAL '7 days'"),
          },
        },
        group: [fn("TO_CHAR", col("LoginTime"), "Dy")],
        order: [[fn("MIN", col("LoginTime")), "ASC"]],
        raw: true,
      });

      const allDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const sessionTrends = allDays.map((day) => {
        const found = sessionData.find((d) => d.day === day);
        return found ? parseInt(found.count, 10) : 0;
      });

      // 3️⃣ Top 10 Favourite Books
      const favouriteBooksData = await models.Favorite.findAll({
        attributes: [
          [col("BookVersion->Book.Title"), "bookName"],
          [fn("COUNT", col("FavoriteId")), "likeCount"],
        ],
        include: [
          {
            model: models.BookVersion,
            as: "BookVersion",
            include: [{ model: models.Book, as: "Book" }],
          },
        ],
        group: [
          col("BookVersion.BookVersionId"), // ✅ required in PostgreSQL
          col("BookVersion->Book.BookId"),
          col("BookVersion->Book.Title"),
        ],
        order: [[fn("COUNT", col("FavoriteId")), "DESC"]],
        limit: 10,
        raw: true,
      });

      const favouriteBooks = {
        categories: favouriteBooksData.map((b) => b.bookName),
        data: favouriteBooksData.map((b) => parseInt(b.likeCount, 10)),
      };

      // 4️⃣ Most Read Books
      const mostReadBooksData = await models.UserEngagement.findAll({
        attributes: [
          [col("BookVersion->Book.Title"), "bookName"],
          [fn("COUNT", col("UserEngagementId")), "readCount"],
        ],
        include: [
          {
            model: models.BookVersion,
            as: "BookVersion",
            include: [{ model: models.Book, as: "Book" }],
          },
        ],
        where: { action: "READ_PAGE" },
        group: [
          col("BookVersion.BookVersionId"), // ✅ required
          col("BookVersion->Book.BookId"),
          col("BookVersion->Book.Title"),
        ],
        order: [[fn("COUNT", col("UserEngagementId")), "DESC"]],
        limit: 10,
        raw: true,
      });

      const mostReadBooks = {
        categories: mostReadBooksData.map((b) => b.bookName),
        data: mostReadBooksData.map((b) => parseInt(b.readCount, 10)),
      };

      // 5️⃣ Top Books (This Month)
      const topBooksMonthData = await models.UserEngagement.findAll({
        attributes: [
          [col("BookVersion->Book.Title"), "bookName"],
          [fn("COUNT", col("UserEngagementId")), "count"],
        ],
        include: [
          {
            model: models.BookVersion,
            as: "BookVersion",
            include: [{ model: models.Book, as: "Book" }],
          },
        ],
        where: {
          CreatedAt: {
            [Op.gte]: literal("DATE_TRUNC('month', NOW())"),
          },
        },
        group: [
          col("BookVersion.BookVersionId"),
          col("BookVersion->Book.BookId"),
          col("BookVersion->Book.Title"),
        ],
        order: [[fn("COUNT", col("UserEngagementId")), "DESC"]],
        limit: 3,
        raw: true,
      });

      const topBooksMonth = {
        labels: topBooksMonthData.map((b) => b.bookName),
        data: topBooksMonthData.map((b) => parseInt(b.count, 10)),
      };

      // 6️⃣ Top Books (This Year)
      const topBooksYearData = await models.UserEngagement.findAll({
        attributes: [
          [col("BookVersion->Book.Title"), "bookName"],
          [fn("COUNT", col("UserEngagementId")), "count"],
        ],
        include: [
          {
            model: models.BookVersion,
            as: "BookVersion",
            include: [{ model: models.Book, as: "Book" }],
          },
        ],
        where: {
          CreatedAt: {
            [Op.gte]: literal("DATE_TRUNC('year', NOW())"),
          },
        },
        group: [
          col("BookVersion.BookVersionId"),
          col("BookVersion->Book.BookId"),
          col("BookVersion->Book.Title"),
        ],
        order: [[fn("COUNT", col("UserEngagementId")), "DESC"]],
        limit: 5,
        raw: true,
      });

      const topBooksYear = {
        labels: topBooksYearData.map((b) => b.bookName),
        data: topBooksYearData.map((b) => parseInt(b.count, 10)),
      };

      // ✅ Final Response
      return success(res, {
        totalActiveUsers,
        sessionTrends: {
          series: [{ name: "Sessions", data: sessionTrends }],
          categories: allDays,
        },
        favouriteBooks,
        mostReadBooks,
        topBooksMonth,
        topBooksYear,
      });
    } catch (err) {
      console.error(err);
      return error(res, err.message);
    }
  });

  return dashboardRouter;
};
