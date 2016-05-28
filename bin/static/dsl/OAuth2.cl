conversation OAuth2 {
  type AccessClient from OAuth2.AccessClient {
  }
  type RoleResult from Authorization.Role {
    path as id
    path as title
  }
  type Role from Authorization.Role {
    accessControlEntries {
      access
      action {
      }
    }
    depth
    id
    path
    organization
  }
  type Login from OAuth2.UserInfo {
    email as username
    ^password
    //String grant_type = "password"
    //String client_id="0"

  }
  type UserInfo from OAuth2.UserInfo {
  }
  type InitAccount from OAuth2.UserInfo {
    email
    name
  }
  type Authorization {
    String response_type pattern "token|code"
    String client_id
    String redirect_uri
  }

  type Registration {
    ref OAuth2.UserInfo email
  }

  type PasswordRequest {
    ref OAuth2.UserInfo email
  }

  type PasswordReset {
    ref OAuth2.PasswordResetInfo code
    String ^password obscured pattern
    "^(?=.*[A-Z])(?=.*[^aA-zZ0-9])(?=.*[0-9]).{6,}$"
    String password2 obscured pattern
    "^(?=.*[A-Z])(?=.*[^aA-zZ0-9])(?=.*[0-9]).{6,}$"
  }

  view /role over /role
  resource /role for OAuth2.Role offers authorized ( create read update delete find ) interchanges ( json )

  resource /roleList for OAuth2.RoleResult offers ( find ) interchanges ( json )

  view /oauth/client over /oauth/client
  resource /oauth/client for OAuth2.AccessClient offers authorized ( create read update ) interchanges ( json form )

  //Create an account which requires activation
  view /auth/account over /auth/account
  resource /auth/account for OAuth2.InitAccount offers anonymous ( post ) interchanges ( json )

  view /login over /auth/token
  //a test endpoint
  resource /auth/orized for OAuth2.Login offers authorized ( find ) interchanges ( json )

  //The following endpoints are here for documentation purpose
  //They will, however, be shadowed by explicit routes in config/initializers/10_auth_routes

  /*
   * test endpoint just to see if you are authenticated
   */
  resource /auth/test for OAuth2.Login offers authenticated ( find ) interchanges ( json )

  /*
   * # Token
   *
   * Used to login
   * valid grant_type=password|code|refresh_token
   * returns a token
   */
  resource /auth/token for OAuth2.Login offers anonymous ( post ) interchanges ( json )

  /*
   * # Authorize
   *
   * Starting point for OAuth2 flows.
   *
   * ## response_type=token
   *
   * Used for implicit token. 302 to redirect_uri with appended Token (application/x-www-form-urlencoded) in the hash (#).
   *
   * ## resonse_type=code
   *
   * Used for getting a code to later exchange for a token. 302 to redirect_uri with appended query param
   */
  resource /auth/authorize for OAuth2.Authorization offers authenticated (find) interchanges (json)

  /*
   * Create a new user
   */
  resource /auth/register for OAuth2.Registration offers anonymous (post) interchanges (json)

  /*
   * Start the password reset process. Sends an email to the requested account email
   */
  resource /auth/reset/request for OAuth2.PasswordRequest offers anonymous (post) interchanges (json)

  /*
   * Use a password reset code to update your password.
   */
  resource /auth/reset for OAuth2.PasswordReset offers  anonymous (post) interchanges (json)

}
