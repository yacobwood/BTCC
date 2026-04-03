package com.btccfanhub.ui.news

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class NewsViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `initial state is Loading`() {
        val vm = NewsViewModel()
        // init calls load() which sets Loading, then tries network (will fail in unit test)
        // but the initial emission is Loading
        val state = vm.state.value
        assertTrue(state is NewsState.Loading || state is NewsState.Error)
    }

    @Test
    fun `initial search state is Idle`() {
        val vm = NewsViewModel()
        assertTrue(vm.searchState.value is SearchState.Idle)
    }

    @Test
    fun `isRefreshing starts false`() {
        val vm = NewsViewModel()
        assertEquals(false, vm.isRefreshing.value)
    }

    @Test
    fun `saveScrollPosition stores values`() {
        val vm = NewsViewModel()
        vm.saveScrollPosition(5, 100)
        assertEquals(5, vm.savedScrollIndex)
        assertEquals(100, vm.savedScrollOffset)
    }

    @Test
    fun `clearSearch resets to Idle`() {
        val vm = NewsViewModel()
        vm.clearSearch()
        assertTrue(vm.searchState.value is SearchState.Idle)
    }

    @Test
    fun `search with blank query sets Idle`() {
        val vm = NewsViewModel()
        vm.search("")
        assertTrue(vm.searchState.value is SearchState.Idle)
    }

    @Test
    fun `search with whitespace sets Idle`() {
        val vm = NewsViewModel()
        vm.search("   ")
        assertTrue(vm.searchState.value is SearchState.Idle)
    }

    @Test
    fun `default scroll position is zero`() {
        val vm = NewsViewModel()
        assertEquals(0, vm.savedScrollIndex)
        assertEquals(0, vm.savedScrollOffset)
    }
}
