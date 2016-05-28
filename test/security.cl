conversation test {
  type test {
  }
  authorized agent test concerning test {
    privately receives aMessage: test

    initially
    receives aMessage becomes tested {
      tested {
      }
    }
  }
  authorized agent best concerning test {
    privately receives aMessage: test

    initially
    receives aMessage becomes tested {
      tested {
      }
    }
  }
  authorized agent lest concerning test {
    privately receives aMessage: test
    //test
    initially
    receives aMessage becomes tested {
      tested {
      }
    }
  }
  resource /sdg for test.test offers ( create ) anonymous ( post ) interchanges ( form )
}