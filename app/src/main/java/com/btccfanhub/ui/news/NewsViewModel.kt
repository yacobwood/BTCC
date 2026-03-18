package com.btccfanhub.ui.news

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.btccfanhub.data.model.Article
import com.btccfanhub.data.repository.NewsRepository
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

sealed class NewsState {
    object Loading : NewsState()
    data class Success(
        val articles: List<Article>,
        val isLoadingMore: Boolean = false,
        val hasMore: Boolean = true,
    ) : NewsState()
    data class Error(val message: String) : NewsState()
}

sealed class SearchState {
    object Idle : SearchState()
    object Loading : SearchState()
    data class Results(
        val articles: List<Article>,
        val isLoadingMore: Boolean = false,
        val hasMore: Boolean = true,
    ) : SearchState()
    data class Error(val message: String) : SearchState()
}

class NewsViewModel : ViewModel() {

    private val _state = MutableStateFlow<NewsState>(NewsState.Loading)
    val state: StateFlow<NewsState> = _state

    private val _searchState = MutableStateFlow<SearchState>(SearchState.Idle)
    val searchState: StateFlow<SearchState> = _searchState

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing

    private var currentPage = 1
    private var isLoadingMore = false
    private var searchJob: Job? = null
    private var searchPage = 1
    private var isLoadingMoreSearch = false

    init {
        load()
    }

    fun load() {
        currentPage = 1
        isLoadingMore = false
        viewModelScope.launch {
            _state.value = NewsState.Loading
            val articles = NewsRepository.getArticles(page = 1)
            _state.value = if (articles.isEmpty()) {
                NewsState.Error("Couldn't load news. Check your connection.")
            } else {
                NewsState.Success(
                    articles = articles,
                    hasMore  = NewsRepository.isFullPage(articles),
                )
            }
        }
    }

    fun refresh() {
        val current = _state.value as? NewsState.Success ?: return
        viewModelScope.launch {
            _isRefreshing.value = true
            val articles = NewsRepository.getArticles(page = 1)
            _isRefreshing.value = false
            if (articles.isNotEmpty()) {
                currentPage = 1
                isLoadingMore = false
                _state.value = current.copy(
                    articles      = articles,
                    hasMore       = NewsRepository.isFullPage(articles),
                    isLoadingMore = false,
                )
            }
        }
    }

    fun loadMore() {
        val current = _state.value as? NewsState.Success ?: return
        if (!current.hasMore || isLoadingMore) return
        isLoadingMore = true
        val nextPage = currentPage + 1
        viewModelScope.launch {
            _state.value = current.copy(isLoadingMore = true)
            val more = NewsRepository.getArticles(page = nextPage)
            currentPage = nextPage
            isLoadingMore = false
            _state.value = current.copy(
                articles      = current.articles + more,
                isLoadingMore = false,
                hasMore       = NewsRepository.isFullPage(more),
            )
        }
    }

    fun search(query: String) {
        searchJob?.cancel()
        searchPage = 1
        isLoadingMoreSearch = false
        if (query.isBlank()) {
            _searchState.value = SearchState.Idle
            return
        }
        searchJob = viewModelScope.launch {
            delay(300)
            _searchState.value = SearchState.Loading
            try {
                val results = NewsRepository.searchArticles(query, page = 1)
                val q = query.lowercase()
                val ranked = results.sortedWith(compareByDescending<Article> {
                    it.title.lowercase().contains(q)
                }.thenByDescending {
                    it.title.lowercase().startsWith(q)
                })
                _searchState.value = SearchState.Results(
                    articles = ranked,
                    hasMore  = NewsRepository.isFullPage(results),
                )
            } catch (e: Exception) {
                _searchState.value = SearchState.Error("Search failed. Check your connection.")
            }
        }
    }

    fun loadMoreSearch(query: String) {
        val current = _searchState.value as? SearchState.Results ?: return
        if (!current.hasMore || isLoadingMoreSearch) return
        isLoadingMoreSearch = true
        val nextPage = searchPage + 1
        viewModelScope.launch {
            _searchState.value = current.copy(isLoadingMore = true)
            try {
                val more = NewsRepository.searchArticles(query, page = nextPage)
                searchPage = nextPage
                _searchState.value = current.copy(
                    articles      = current.articles + more,
                    isLoadingMore = false,
                    hasMore       = NewsRepository.isFullPage(more),
                )
            } catch (e: Exception) {
                _searchState.value = current.copy(isLoadingMore = false)
            } finally {
                isLoadingMoreSearch = false
            }
        }
    }

    fun clearSearch() {
        searchJob?.cancel()
        _searchState.value = SearchState.Idle
    }
}
