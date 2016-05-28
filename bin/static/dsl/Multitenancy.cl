conversation Multitenancy {
  type Organization from Multitenancy.Organization {
  }
  resource /organizations for Multitenancy.Organization offers authenticated (create find read) authorized (update delete) interchanges (json)
}
