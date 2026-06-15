const models = require("../models");
const APIError = require("../utils/error");
const issue = models.issue;
const Upvote = models.Upvotes;
const Downvote = models.Downvotes;
const Comment = models.Comments;
const User = models.User;
const NotificationService = require("./notification");
const { Op, Sequelize, fn, literal, col } = require("sequelize");

/**
 * Fetches issues from the database based on a given search query.
 *
 * This function filters out archived issues and applies the search query
 * to both the title and description of the issue.
 *
 * The search query is case insensitive and supports the @ symbol to search
 * for specific users.
 *
 * @param {string} query The search query to apply.
 * @param {number} userId The user ID of the requester
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of
 * issue objects.
 */
async function getIssues(query, userId) {
  const includeAttributes = [
    [
      Sequelize.fn(
        "COUNT",
        Sequelize.fn("DISTINCT", Sequelize.col("UpvoteEntries.id")),
      ),
      "upvoteCount",
    ],
    [
      Sequelize.fn(
        "COUNT",
        Sequelize.fn("DISTINCT", Sequelize.col("DownvoteEntries.id")),
      ),
      "downvoteCount",
    ],
    [
      Sequelize.literal(
        `COUNT(DISTINCT "UpvoteEntries"."id") - COUNT(DISTINCT "DownvoteEntries"."id")`,
      ),
      "score",
    ],
  ];
  const includeModels = [
    {
      model: Upvote,
      as: "UpvoteEntries", // This alias must match the string in Sequelize.col
      attributes: [],
      required: false,
    },
    {
      model: Downvote,
      as: "DownvoteEntries",
      attributes: [],
      required: false,
    },
    {
      model: models.User,
      as: "user",
      attributes: ["email"],
    },
  ];

  const group = [Sequelize.col("issue.id"), Sequelize.col("user.id")];

  if (userId) {
    includeAttributes.push(
      [
        Sequelize.literal(`EXISTS (
              SELECT 1 FROM "Upvotes" u
              WHERE u."issueId" = "issue"."id"
                AND u."userId" = ${userId}
            )`),
        "hasUpvoted",
      ],
      [
        Sequelize.literal(`EXISTS (
              SELECT 1 FROM "Downvotes" d
              WHERE d."issueId" = "issue"."id"
                AND d."userId" = ${userId}
            )`),
        "hasDownvoted",
      ],
    );
  }

  let issues = await issue.findAll({
    where:
      query && !query.includes("@")
        ? {
            archived: false,
            [Op.or]: [
              { title: { [Op.iLike]: `%${query}%` } },
              { description: { [Op.iLike]: `%${query}%` } },
            ],
          }
        : {
            archived: false,
          },
    attributes: {
      include: includeAttributes,
    },

    include: includeModels,

    group: group,
    order: [[Sequelize.literal("score"), "DESC"]],
    raw: true,
  });

  // Check if the query includes an @
  if (query && query.includes("@")) {
    issues = issues.filter((issue) =>
      (issue["user.email"] || "")
        .toLowerCase()
        .includes((query.split("@")[1] || "").toLowerCase()),
    );
  }

  // Get the IDs of all issues fetched in the first step
  const issueIds = issues.map((issue) => issue.id);

  const comments = await Comment.findAll({
    where: {
      issueId: { [Sequelize.Op.in]: issueIds },
    },
    include: [
      {
        model: models.User,
        as: "User", // Match the 'as' used in the Comment model association
        attributes: ["email", "admin", "tester"],
      },
    ],
    order: [["createdAt", "ASC"]], // Sort comments by time
    raw: true,
    // Add attributes to get fields like text, id, userId, createdAt
    attributes: ["id", "userId", "text", "createdAt", "issueId"],
  });

  // 3a. Prepare an organized map of comments for quick lookup
  const commentsMap = {};
  for (const comment of comments) {
    const issueId = comment.issueId;

    // Format the comment object to match the desired JSON structure
    const formattedComment = {
      id: comment.id,
      userId: comment.userId,
      // Sequelize prefixes nested raw attributes with the association name
      username: comment["User.email"],
      byAdmin: comment["User.admin"],
      byTester: comment["User.tester"],
      text: comment.text,
      createdAt: comment.createdAt,
    };

    if (!commentsMap[issueId]) {
      commentsMap[issueId] = [];
    }
    commentsMap[issueId].push(formattedComment);
  }

  // 3b. Add the comments array to each issue
  const finalResult = issues.map((issue) => {
    // Attach the comments array, or an empty array if none exist
    issue.comments = commentsMap[issue.id] || [];
    return issue;
  });

  return finalResult;
}

/**
 * Retrieves an issue by its ID
 * @param {number} id - The ID of the issue to retrieve
 * @throws {APIError} If the issue does not exist
 * @returns {Promise<issue>} A promise resolving to the retrieved issue
 */
async function getIssue(id) {
  const result = await issue.findByPk(id);
  if (!result) throw APIError.errorNotFound();
  return result;
}

/**
 * Creates a new issue with the given data and associates it with the given user.
 * @param {Object} data - The data to create the issue with.
 * @param {number} userId - The ID of the user that created the issue.
 * @throws {APIError} If the issue could not be created.
 * @returns {Promise<issue>} A promise resolving to the created issue.
 */
async function createIssue(data, userId) {
  const created = await issue.create({ ...data, userId });

  const createdWithUser = await issue.findByPk(created.id, {
    include: [
      {
        model: User,
        as: "user",
        attributes: ["email"],
      },
      {
        model: Upvote,
        as: "UpvoteEntries",
      },
      {
        model: Downvote,
        as: "DownvoteEntries",
      },
    ],
  });
  return createdWithUser;
}

/**
 * Updates an issue with the given id and data.
 * @param {number} id - The id of the issue to update.
 * @param {Object} data - The data to update the issue with.
 * @throws {APIError} If the issue does not exist.
 * @returns {Promise<Object[]>} A promise resolving to the updated issue.
 */
async function updateIssue(id, data) {
  const updated = await issue.update(data, { where: { id } });
  if (updated[0] === 0) throw APIError.errorNotFound();
  return updated;
}

/**
 * Archives an issue with the given ID.
 * @param {number} id - The ID of the issue to archive.
 * @throws {APIError} If the issue does not exist.
 * @returns {Promise<void>} A promise resolving when the issue has been archived.
 */
async function archiveIssue(id) {
  await updateIssue(id, { archived: true });
}

/**
 * Toggles an upvote for a given issue by a given user.
 * If the user has already upvoted the issue, it will delete the upvote and downvote.
 * If the user has not upvoted the issue, it will create an upvote and delete any downvotes.
 * @param {number} issueId - The id of the issue to toggle the upvote for.
 * @param {number} userId - The id of the user to toggle the upvote for.
 * @returns {Promise<void>} A promise resolving when the upvote has been toggled.
 */
async function toggleUpvote(issueId, userId) {
  const hasUpvoted =
    (await Upvote.findOne({
      where: { userId, issueId },
    })) !== null;

  if (hasUpvoted) {
    await deleteDownvote(issueId, userId);
    await deleteUpvote(issueId, userId);
  } else {
    await createUpvote(issueId, userId);
    await deleteDownvote(issueId, userId);
  }
}

/**
 * Toggles a downvote for a given issue by a given user.
 * If the user has already downvoted the issue, it will delete the downvote and upvote.
 * If the user has not downvoted the issue, it will create a downvote and delete any upvotes.
 * @param {number} issueId - The id of the issue to toggle the downvote for.
 * @param {number} userId - The id of the user to toggle the downvote for.
 * @returns {Promise<void>} A promise resolving when the downvote has been toggled.
 */
async function toggleDownvote(issueId, userId) {
  const hasDownvoted =
    (await Downvote.findOne({
      where: { userId, issueId },
    })) !== null;

  if (hasDownvoted) {
    await deleteDownvote(issueId, userId);
    await deleteUpvote(issueId, userId);
  } else {
    await createDownvote(issueId, userId);
    await deleteUpvote(issueId, userId);
  }
}

/**
 * Deletes a downvote for a given issue by a given user.
 * @param {number} issueId - The id of the issue to delete the downvote for.
 * @param {number} userId - The id of the user to delete the downvote for.
 * @returns {Promise<void>} A promise resolving when the downvote has been deleted.
 */
async function deleteDownvote(issueId, userId) {
  await Downvote.destroy({ where: { issueId, userId } });
}
/**
 * Deletes an upvote for a given issue by a given user.
 * @param {number} issueId - The id of the issue to delete the upvote for.
 * @param {number} userId - The id of the user to delete the upvote for.
 * @returns {Promise<void>} A promise resolving when the upvote has been deleted.
 */
async function deleteUpvote(issueId, userId) {
  await Upvote.destroy({ where: { issueId, userId } });
}
/**
 * Creates a downvote for a given issue by a given user.
 * @param {number} issueId - The id of the issue to create the downvote for.
 * @param {number} userId - The id of the user to create the downvote for.
 * @returns {Promise<void>} A promise resolving when the downvote has been created.
 */
async function createDownvote(issueId, userId) {
  await Downvote.create({ userId, issueId });
}
/**
 * Creates an upvote for a given issue by a given user.
 * @param {number} issueId - The id of the issue to create the upvote for.
 * @param {number} userId - The id of the user to create the upvote for.
 * @returns {Promise<void>} A promise resolving when the upvote has been created.
 */
async function createUpvote(issueId, userId) {
  await Upvote.create({ userId, issueId });
}

/**
 * Creates a new comment with the given data and associates it with the given user and issue.
 * @param {Object} data - The data to create the comment with.
 * @param {number} userId - The id of the user that created the comment.
 * @param {number} issueId - The id of the issue that the comment is associated with.
 * @throws {APIError} If the comment could not be created.
 * @returns {Promise<Comment>} A promise resolving to the created comment.
 */
async function createComment(data, userId, issueId) {
  const created = await Comment.create({ ...data, userId, issueId });
  return created;
}

/**
 * Deletes a comment with the given ID.
 * @param {number} id - The ID of the comment to delete.
 * @throws {APIError} If the comment could not be found.
 * @returns {Promise<number>} A promise resolving to the number of deleted comments.
 */
async function deleteComment(id) {
  const deleted = await Comment.destroy({ where: { id } });
  if (deleted === 0) throw APIError.errorNotFound();
  return deleted;
}

/**
 * Checks if a user owns an issue.
 * @param {number} userId - The ID of the user to check.
 * @param {number} issueId - The ID of the issue to check.
 * @returns {Promise<boolean>} A promise resolving to a boolean indicating whether the user owns the issue.
 */
async function userOwnsIssue(userId, issueId) {
  const issue = await getIssue(issueId);
  return issue.userId === userId;
}

module.exports = {
  getIssues,
  getIssue,
  createIssue,
  updateIssue,
  archiveIssue,
  toggleUpvote,
  toggleDownvote,
  createComment,
  deleteComment,
  userOwnsIssue,
};
