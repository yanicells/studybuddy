mod app;

use gpui::{
    actions, px, size, App, AppContext, Application, Bounds, KeyBinding, Menu, MenuItem,
    TitlebarOptions, WindowBounds, WindowOptions,
};

use crate::app::Studybuddy;

actions!(studybuddy, [Quit]);

fn load_env() {
    let _ = dotenvy::dotenv();
    if let Ok(mut exe) = std::env::current_exe() {
        exe.pop();
        let _ = dotenvy::from_path(exe.join(".env"));
    }
}

fn quit(_: &Quit, cx: &mut App) {
    cx.quit();
}

fn main() {
    load_env();

    Application::new().run(|cx| {
        gpui_component::init(cx);
        cx.on_action(quit);
        cx.bind_keys([KeyBinding::new("cmd-q", Quit, None)]);
        cx.set_menus(vec![Menu {
            name: "Studybuddy".into(),
            items: vec![MenuItem::action("Quit", Quit)],
        }]);

        let bounds = Bounds::centered(None, size(px(1120.), px(740.)), cx);
        cx.open_window(
            WindowOptions {
                window_bounds: Some(WindowBounds::Windowed(bounds)),
                window_min_size: Some(size(px(880.), px(560.))),
                titlebar: Some(TitlebarOptions {
                    title: Some("Studybuddy".into()),
                    appears_transparent: false,
                    traffic_light_position: None,
                }),
                app_id: Some("dev.yanicells.studybuddy".into()),
                ..Default::default()
            },
            |window, cx| {
                let view = cx.new(|cx| Studybuddy::new(window, cx));
                cx.new(|cx| gpui_component::Root::new(view, window, cx))
            },
        )
        .unwrap();
        cx.activate(true);
    });
}
