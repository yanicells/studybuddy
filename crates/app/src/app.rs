use gpui::{div, prelude::*, px, rgb, Context, Window};

pub struct Studybuddy;

impl Studybuddy {
    pub fn new(_window: &mut Window, _cx: &mut Context<Self>) -> Self {
        Self
    }
}

impl Render for Studybuddy {
    fn render(&mut self, _window: &mut Window, _cx: &mut Context<Self>) -> impl IntoElement {
        div()
            .size_full()
            .flex()
            .items_center()
            .justify_center()
            .bg(rgb(0xF4F6F7))
            .text_color(rgb(0x1C2430))
            .child(
                div()
                    .flex()
                    .flex_col()
                    .items_center()
                    .gap_2()
                    .child(
                        div()
                            .w(px(18.))
                            .h(px(18.))
                            .rounded_sm()
                            .bg(rgb(0x3F6F8A)),
                    )
                    .child("Studybuddy"),
            )
    }
}
