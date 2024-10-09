// script.js
document.addEventListener('DOMContentLoaded', () => {
    const carousel = document.querySelector('.carousel-container');
    const items = document.querySelectorAll('.carousel-item');
    const prevButton = document.querySelector('.prev');
    const nextButton = document.querySelector('.next');
    let currentIndex = 0;

    function showItem(index) {
        carousel.style.transform = `translateX(-${index * 100}%)`;
    }

    function showNext() {
        currentIndex = (currentIndex + 1) % items.length;
        showItem(currentIndex);
    }

    function showPrev() {
        currentIndex = (currentIndex - 1 + items.length) % items.length;
        showItem(currentIndex);
    }

    nextButton.addEventListener('click', showNext);
    prevButton.addEventListener('click', showPrev);
});