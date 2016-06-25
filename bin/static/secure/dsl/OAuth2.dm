import Authorization
domain-model OAuth2 {
  node-mongo-options {
    extensions {
      AuthorizationCode {
        ttl expires 0 single-table-root
      }
      AbstractToken {
        ttl expires 0
      }
      UserInfo {
        single-table-root
      }
      PasswordResetInfo {
        ttl expires 0
      }
    }
  }
  entity AccessClient {
    String id unique
    String name
    String clientSecret? obscured pattern
    "^(?=.*[A-Z])(?=.*[^aA-zZ0-9])(?=.*[0-9]).{6,}$"
    String redirectUri? pattern "^http[s]?:\\/\\/.*$"
    key ( id )
  }
  abstract entity Token {
    ref UserInfo ^user
    ref AccessClient client
    Date issued
    Date expires
    String scope?
  }
  abstract entity AbstractToken extends Token {
    ref AbstractToken root
    String token unique
    key ( token )
  }
  entity AccessToken extends AbstractToken {
  }
  entity RefreshToken extends AbstractToken {
  }
  entity AuthorizationCode extends Token {
    String code unique
    String redirectUri
    key ( code )
  }
  abstract entity PasswordResetInfo {
    ShortId code? unique "ASDFGHJKLQWERTYUPZXCVBNM23456789" 33445566
    Date issued
    Date expires!
    ref UserInfo email
    key ( code )
  }
  abstract entity UserInfo {
    String email! unique pattern
    "^[aA-zZ0-9._%+-]+@[aA-zZ0-9.-]+\\.[aA-zZ]{2,}$"
    String name
    String ^password? obscured pattern
    "^(?=.*[A-Z])(?=.*[^aA-zZ0-9])(?=.*[0-9]).{6,}$"
    ref Authorization.Role roles*
    key ( email )
  }
}