

// Toggle the filter sidebar
let filterBtn = document.querySelector('.filter');
let filterSlide = document.querySelector('.filter_sidebar');
let filterClose = document.querySelector('.close');

if (filterBtn && filterSlide && filterClose) {
    filterBtn.addEventListener('click', () => {
        filterSlide.classList.toggle('active');
    });

    filterClose.addEventListener('click', () => {
        filterSlide.classList.toggle('active');
    });
}

// Toggle filter content boxes
let filterBoxes = document.querySelectorAll('.filter_content__box');
filterBoxes.forEach((box) => {
    box.addEventListener('click', function () {
        this.classList.toggle('show');
    });
});

// Toggle purchase type inputs
let size = document.querySelectorAll('.purchase_type__input');
size.forEach((input) => {
    input.addEventListener('click', function () {
        this.classList.toggle('active-btn');
    });
});


document.querySelectorAll('.filter_select__input').forEach(function (input) {
    input.addEventListener('click', function (event) {
        event.stopPropagation();
    });
});
