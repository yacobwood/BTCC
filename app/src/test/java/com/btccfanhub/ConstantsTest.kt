package com.btccfanhub

import org.junit.Assert.assertEquals
import org.junit.Test

class ConstantsTest {

    @Test fun `round 1 starts at race 1`()  { assertEquals(1,  Constants.firstRaceNumberForRound(1))  }
    @Test fun `round 2 starts at race 4`()  { assertEquals(4,  Constants.firstRaceNumberForRound(2))  }
    @Test fun `round 3 starts at race 7`()  { assertEquals(7,  Constants.firstRaceNumberForRound(3))  }
    @Test fun `round 10 starts at race 28`() { assertEquals(28, Constants.firstRaceNumberForRound(10)) }
}
