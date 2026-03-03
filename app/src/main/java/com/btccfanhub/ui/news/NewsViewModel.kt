package com.btccfanhub.ui.news

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.btccfanhub.data.model.Article
import com.btccfanhub.data.repository.NewsRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

sealed class NewsState {
    object Loading : NewsState()
    data class Success(val articles: List<Article>) : NewsState()
    data class Error(val message: String) : NewsState()
}

class NewsViewModel : ViewModel() {

    private val _state = MutableStateFlow<NewsState>(NewsState.Loading)
    val state: StateFlow<NewsState> = _state

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _state.value = NewsState.Loading
            val articles = NewsRepository.getArticles()
            _state.value = if (articles.isEmpty()) {
                NewsState.Error("Couldn't load news. Check your connection.")
            } else {
                NewsState.Success(articles)
            }
        }
    }
}
