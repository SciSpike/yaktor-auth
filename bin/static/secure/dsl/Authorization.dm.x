import OAuth2
import Multitenancy
domain-model Authorization {
  node-mongo-options {
  }
  enum AccessRequirement {
    ANONYMOUS = "ANONYMOUS" AUTHENTICATED = "AUTHENTICATED" AUTHORIZED =
    "AUTHORIZED"
  }
  enum Access {
    GRANT = "GRANTED" DENIED = "DENIED"
  }
  //  Actions are populated by the conversation components, they're not part of domain model
  //  entity Action {
  //    String path
  //    String securable
  //    //default ANON
  //    enum AccessRequirement accessRequirement?
  //    key ( path )
  //  }
  enum Method {
    CREATE = "create" GET = "get" POST = "post" DELETE = "delete" PUT = "put"
  }
  type Action {
  /* A regex path to the resource, such as "/myEndpoint/.*" for access to everything under trials  */
    String path
    /* The methods at the path to be secured, a for RESTful verb*/
    enum Method methods*
  }
  /* Controls access to specific resource by path */
  type AccessControlEntry {
  //    ref Action path
    Action action
    /* The type of access, either granted or denied */
    enum Access access
  }
  abstract entity AccessController {
    String id pattern "^\\w+$" unique
    AccessControlEntry accessControlEntries*
    key ( id )
  }
  entity Role extends AccessController {
  //as in Materialized Path
    String path pattern "^,(\\w+,)*$" indexed
    Integer depth [ 0 .. 7 ]
    ref Multitenancy.Organization organization?
  }
}
