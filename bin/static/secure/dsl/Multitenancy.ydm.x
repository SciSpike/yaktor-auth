domain-model Multitenancy {
  node-mongo-options {
  }

  entity Organization {
    String name unique indexed
  }
}
