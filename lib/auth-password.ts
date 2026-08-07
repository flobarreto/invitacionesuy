export const ADMIN_PASSWORD_BCRYPT_ROUNDS = 10

// Hash of a fixed, non-secret placeholder. It exists only to make an unknown
// username pay the same bcrypt cost as a real administrator password.
export const INVALID_ADMIN_PASSWORD_HASH =
  "$2b$10$QWfsnuDLvUt2mOTP6CXw/e.EJ36GBrL.ziAeRtC5P.WsRWxoL.vea"

