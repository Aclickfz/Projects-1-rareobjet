window.addEventListener("scroll", function () {
    var header = this.document.querySelector(".myNav_content");
    header.classList.toggle("sticky", this.window.scrollY > 0);
});



var menu = document.querySelector('.menu_icon');
var navbar = document.querySelector('.mobile_nav');
var cancelMenu = document.querySelector('.close-icon')
menu.addEventListener('click', () => {
    navbar.classList.toggle('active');
});
cancelMenu.addEventListener('click', () => {
    navbar.classList.toggle('active');
});

// search mobile
var searchBtn = document.querySelector('.search-icon');
var searchBox = document.querySelector('.search--input');
searchBtn.addEventListener('click', () => {
    searchBox.classList.toggle('show');
});


var megaDrops = document.querySelectorAll('.dropBtn');

for (var i = 0; i < megaDrops.length; i++) {
    megaDrops[i].addEventListener('click', function () {
        // First, remove the 'megaDrop_active' class from all .dropBtn elements
        megaDrops.forEach(function (btn) {
            btn.classList.remove('megaDrop_active');
        });

        // Then, toggle the 'megaDrop_active' class on the clicked button
        this.classList.toggle('megaDrop_active');
    });
}


// Get all elements with the class 'megadropBtn'
const dropdownButtons = document.querySelectorAll('.megadropBtn');

dropdownButtons.forEach(button => {
    button.addEventListener('click', function () {
        // Remove 'active' class from all .megadropBtn elements
        dropdownButtons.forEach(btn => btn.classList.remove('active'));

        // Add 'active' class to the clicked button
        this.classList.add('active');
    });
});



function myFunction(smallImg) {
    var fullImg = document.getElementById("imgBox");
    fullImg.src = smallImg.src;
}