class APIError extends Error {
  constructor(
    title = "Unknown Error",
    message = "Please try again at a later time or report this issue",
    code = 500,
  ) {
    super();
    this.name = this.constructor.name;
    ((this.title = title), (this.message = message));
    this.statusCode = code;
    this.success = false;

    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = new Error(message).stack;
    }
  }

  /**
   * Returns an APIError indicating that the requested resource is protected and that no authentication was provided.
   * @return {APIError} An APIError object with a status code of 401.
   * The title is "The requested resource is protected" and the message is "Please make sure to login.".
   * @description This error is thrown when the requested resource is protected
   * and that no authentication was provided.
   */
  static errorUnauthorized() {
    return new APIError(
      "The requested resource is protected",
      "Please make sure to login.",
      401,
    );
  }

  /**
   * Returns an APIError indicating that the authentication token is malformed.
   * @return {APIError} An APIError object with a status code of 401.
   * The title is "Authentication failed" and the message is "Invalid or malformed Token. Please login again.".
   * @description This error is thrown when the authentication token is malformed.
   */
  static errorTokenMalformed() {
    return new APIError(
      "Authentication failed",
      "Invalid or malformed Token. Please login again.",
      401,
    );
  }

  /**
   * Returns an APIError indicating that the requested resource is protected,
   * and that no authentication token was provided.
   * @return {APIError} An APIError object with a status code of 401.
   * The title is "Authentication failed" and the message is "Token is missing. Please provide a Token or login again."
   */
  static errorTokenMissing() {
    return new APIError(
      "Authentication failed",
      "Token is missing. Please provide a Token or login again.",
      401,
    );
  }

  /**
   * Returns an APIError indicating that the OTP has already been generated.
   * This error is thrown when the OTP has already been generated and the user
   * tries to generate a new one.
   * @return {APIError} An APIError object with a status code of 401.
   * The title is "OTP already generated" and the message is
   * "The OTP has already been generated. Please try again later.".
   */
  static errorOTPAlreadyGenerated() {
    return new APIError(
      "OTP already generated",
      "The OTP has already been generated. Please try again later.",
      401,
    );
  }

  /**
   * Returns an APIError indicating that the requested resource is protected
   * and the user does not have the required rights.
   * @return {APIError} The error to be returned.
   * @description This error is thrown when the requested resource is protected
   * and the user does not have the required rights.
   * The title is "The requested resource is protected" and the message is
   * "You have don't have the required rights.".
   * The status code is 403.
   */
  static errorForbidden() {
    return new APIError(
      "The requested resource is protected",
      "You have don't have the required rights.",
      403,
    );
  }

  /**
   * Returns an APIError indicating that the requested resource does not exist.
   * @return {APIError} The error to be returned.
   * @description This error is thrown when the requested resource does not exist.
   * The title is "The requested resource does not exist" and the message is "Please check your request."
   * The status code is 404.
   */
  static errorNotFound() {
    return new APIError(
      "The requested resource does not exist",
      "Please check your request.",
      404,
    );
  }

  /**
   * Returns an APIError indicating that the User could not be found.
   * @returns {APIError} The error to be returned.
   */
  static errorUserNotFound() {
    return new APIError(
      "User not found",
      "Could not resolve User by Email or id. Please check your request.",
      404,
    );
  }

  /**
   * Creates an APIError for when the user tries to create an account that already exists.
   *
   * @return {APIError} An APIError object with a status code of 409.
   * The message is "User already exists" and the title is "User already exists".
   * The description is "If you forgot your credentials please use the Password-Reset Service.".
   */
  static errorUserAlreadyExists() {
    return new APIError(
      "User already exists",
      "If you forgot your credentials please use the Password-Reset Service.",
      409,
    );
  }

  /**
   * Creates an APIError for when the user provides wrong credentials.
   *
   * @return {APIError} An APIError object with a status code of 422.
   */
  static errorWrongCredentials() {
    return new APIError(
      "Wrong credentials",
      "Either email and/or password are wrong.",
      422,
    );
  }

  /**
   * Creates an APIError for validation errors.
   *
   * @param {string} message - A message describing the validation error.
   * @return {APIError} An APIError object with a status code of 422.
   */
  static errorValidation(message) {
    return new APIError("Validation error", message, 422);
  }

  /**
   * Unknown error occurred. This error is returned when
   * an error occurs for which there is no specific error
   * type defined.
   *
   * @return {APIError} An APIError object with a status code of 500.
   */
  static errorUnknown() {
    return new APIError(
      "Unknown Error",
      "Please try again at a later time or report this issue.",
      500,
    );
  }
}

module.exports = APIError;
