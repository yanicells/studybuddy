mod app;

use std::borrow::Cow;

use anyhow::Result;
use gpui::{
    actions, px, rgb, size, App, AppContext, Application, AssetSource, Bounds, Hsla, KeyBinding,
    Menu, MenuItem, SharedString, TitlebarOptions, WindowBounds, WindowOptions,
};
use gpui_component::{Theme, ThemeMode};

use crate::app::Studybuddy;

struct Assets;

impl AssetSource for Assets {
    fn load(&self, path: &str) -> Result<Option<Cow<'static, [u8]>>> {
        match path.trim_start_matches('/') {
            "icon.svg" => Ok(Some(Cow::Borrowed(include_bytes!(
                "../../../assets/icon.svg"
            )))),
            _ => Ok(None),
        }
    }

    fn list(&self, path: &str) -> Result<Vec<SharedString>> {
        let path = path.trim_start_matches('/');
        if "icon.svg".starts_with(path) {
            Ok(vec!["icon.svg".into()])
        } else {
            Ok(vec![])
        }
    }
}

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

fn apply_mono_theme(cx: &mut App) {
    Theme::change(ThemeMode::Light, None, cx);
    let theme = Theme::global_mut(cx);
    let ink: Hsla = rgb(0x111111).into();
    let paper: Hsla = rgb(0xFFFFFF).into();
    let hover: Hsla = rgb(0xF5F5F5).into();
    let line: Hsla = rgb(0xE5E5E5).into();
    let muted: Hsla = rgb(0x737373).into();
    let ink_hover: Hsla = rgb(0x2A2A2A).into();
    let wash: Hsla = rgb(0xFAFAFA).into();

    theme.background = paper;
    theme.foreground = ink;
    theme.border = line;
    theme.input = line;
    theme.accent = hover;
    theme.accent_foreground = ink;
    theme.muted = hover;
    theme.muted_foreground = muted;
    theme.primary = ink;
    theme.primary_hover = ink_hover;
    theme.primary_active = rgb(0x000000).into();
    theme.primary_foreground = paper;
    theme.secondary = hover;
    theme.secondary_hover = rgb(0xEEEEEE).into();
    theme.secondary_active = rgb(0xE5E5E5).into();
    theme.secondary_foreground = ink;
    theme.danger = ink;
    theme.danger_hover = ink_hover;
    theme.danger_active = rgb(0x000000).into();
    theme.danger_foreground = paper;
    theme.success = ink;
    theme.success_hover = ink_hover;
    theme.success_active = rgb(0x000000).into();
    theme.success_foreground = paper;
    theme.info = ink;
    theme.info_hover = ink_hover;
    theme.info_active = rgb(0x000000).into();
    theme.info_foreground = paper;
    theme.warning = ink;
    theme.warning_hover = ink_hover;
    theme.warning_active = rgb(0x000000).into();
    theme.warning_foreground = paper;
    theme.ring = ink;
    theme.caret = ink;
    theme.link = ink;
    theme.link_hover = ink_hover;
    theme.link_active = rgb(0x000000).into();
    theme.selection = rgb(0xD4D4D4).into();
    theme.sidebar = wash;
    theme.sidebar_foreground = ink;
    theme.sidebar_border = line;
    theme.sidebar_accent = hover;
    theme.sidebar_accent_foreground = ink;
    theme.sidebar_primary = ink;
    theme.sidebar_primary_foreground = paper;
    theme.popover = paper;
    theme.popover_foreground = ink;
    theme.list_hover = hover;
    theme.list_active = ink;
    theme.list_active_border = ink;
    theme.progress_bar = ink;
    theme.slider_bar = ink;
    theme.slider_thumb = ink;
    theme.scrollbar_thumb = rgb(0xC4C4C4).into();
    theme.scrollbar_thumb_hover = rgb(0xA3A3A3).into();
}

fn main() {
    load_env();

    Application::new().with_assets(Assets).run(|cx| {
        gpui_component::init(cx);
        apply_mono_theme(cx);
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
        set_dock_icon();
    });
}

#[cfg(target_os = "macos")]
fn set_dock_icon() {
    use cocoa::appkit::{NSApp, NSApplication, NSImage};
    use cocoa::base::nil;
    use cocoa::foundation::NSData;

    let bytes: &[u8] = include_bytes!("../../../assets/app-icon.png");
    unsafe {
        let data = NSData::dataWithBytes_length_(
            nil,
            bytes.as_ptr() as *const _,
            bytes.len() as u64,
        );
        let image = NSImage::initWithData_(NSImage::alloc(nil), data);
        if image != nil {
            NSApp().setApplicationIconImage_(image);
        }
    }
}

#[cfg(not(target_os = "macos"))]
fn set_dock_icon() {}
