const MessageType = Object.freeze({
  SUCCESS: 1,
  ERROR: 2,
  WARNING: 3,
  INFO: 4,
});

module.exports = {
  MessageType,

  success: (
    res,
    data = {},
    message = "Success",
    messageType = MessageType.SUCCESS,
    status = 200
  ) => {
    return res.status(status).json({
      success: true,
      message,
      messageType,
      data,
    });
  },

  error: (
    res,
    message = "Something went wrong",
    messageType = MessageType.ERROR,
    status = 500
  ) => {
    return res.status(status).json({
      success: false,
      message,
      messageType,
      data: null,
    });
  },

  warning: (
    res,
    message = "Warning",
    messageType = MessageType.WARNING,
    status = 200
  ) => {
    return res.status(status).json({
      success: false,
      message,
      messageType,
      data: null,
    });
  },
};
