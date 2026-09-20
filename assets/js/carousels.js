document.addEventListener('DOMContentLoaded', () => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sliders = [];
    if (window.jQuery?.fn.slick) {
        window.jQuery('.banner_slider, .collection_wrapper__right, .media_hover').each(function () {
            if (this.children.length < 2 || this.classList.contains('slick-initialized')) return;
            const slider = window.jQuery(this);
            slider.slick({ slidesToShow: 1, slidesToScroll: 1, infinite: false, autoplay: false, arrows: false, dots: true, speed: motion.matches ? 0 : 350, adaptiveHeight: false, accessibility: true });
            sliders.push(slider);
        });
    }
    const swipers = [];
    if (window.Swiper) {
        document.querySelectorAll('.swiper').forEach(element => {
            const category = element.classList.contains('mySwiper2');
            const options = {
                slidesPerView: category ? 2 : 1.2, spaceBetween: 16, speed: motion.matches ? 0 : 350, watchOverflow: true,
                keyboard: { enabled: true, onlyInViewport: true }, a11y: { enabled: true },
                breakpoints: { 480: { slidesPerView: 2 }, 768: { slidesPerView: 3 }, 1200: { slidesPerView: category ? 5 : 3 } }
            };
            const nextEl = element.querySelector('.swiper-button-next');
            const prevEl = element.querySelector('.swiper-button-prev');
            const scrollbar = element.querySelector('.swiper-scrollbar');
            const pagination = element.querySelector('.swiper-pagination');
            if (nextEl && prevEl) options.navigation = { nextEl, prevEl };
            if (scrollbar) options.scrollbar = { el: scrollbar, draggable: true };
            if (pagination) options.pagination = { el: pagination, clickable: true };
            swipers.push(new Swiper(element, options));
        });
    }
    motion.addEventListener('change', () => {
        sliders.forEach(slider => slider.slick('slickSetOption', 'speed', motion.matches ? 0 : 350));
        swipers.forEach(swiper => { swiper.params.speed = motion.matches ? 0 : 350; });
    });
});
