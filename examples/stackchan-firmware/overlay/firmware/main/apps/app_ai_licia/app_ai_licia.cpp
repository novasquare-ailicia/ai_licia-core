/*
 * SPDX-FileCopyrightText: 2026 NovaSquare Ltd
 *
 * SPDX-License-Identifier: MIT
 */
#include "app_ai_licia.h"

#include <assets/assets.h>
#include <apps/common/common.h>
#include <hal/hal.h>
#include <mooncake_log.h>
#include <stackchan/stackchan.h>
#include <stackchan/modifiers/blink.h>

using namespace mooncake;
using namespace smooth_ui_toolkit::lvgl_cpp;
using namespace stackchan;

AppAiLicia::AppAiLicia()
{
    setAppInfo().name = "AI_LICIA";
    static auto icon = assets::get_image("icon_ai_licia.png");
    setAppInfo().icon = static_cast<void*>(&icon);
    static uint32_t themeColor = 0x7A5AF8;
    setAppInfo().userData = static_cast<void*>(&themeColor);
}

void AppAiLicia::onCreate()
{
    mclog::tagInfo(getAppInfo().name, "on create");
}

void AppAiLicia::onOpen()
{
    mclog::tagInfo(getAppInfo().name, "on open");
    std::unique_ptr<view::LoadingPage> loadingPage;
    {
        LvglLockGuard lock;
        loadingPage = std::make_unique<view::LoadingPage>(0x7A5AF8, 0xFFFFFF);
        loadingPage->setMessage("ai_licia\nConnecting to Wi-Fi");
    }
    GetHAL().startNetwork([&](std::string_view message) {
        LvglLockGuard lock;
        loadingPage->setMessage(message);
    });

    {
        LvglLockGuard lock;
        loadingPage.reset();
        auto avatar = std::make_unique<avatar::DefaultAvatar>();
        avatar->init(lv_screen_active());
        GetStackChan().attachAvatar(std::move(avatar));
        GetStackChan().addModifier(std::make_unique<BlinkModifier>());
        GetStackChan().motion().setAutoAngleSyncEnabled(false);
        GetStackChan().motion().setAutoTorqueReleaseEnabled(true);
        view::create_home_indicator([this]() { close(); }, 0x9C86FA, 0x251B52);
        view::create_status_bar(0x9C86FA, 0x251B52);
    }

    _client = std::make_unique<AiLiciaAvatarClient>();
    _client->start();
}

void AppAiLicia::onRunning()
{
    if (_client) _client->update();
    LvglLockGuard lock;
    updateStatus();
    GetStackChan().update();
    view::update_home_indicator();
    view::update_status_bar();
}

void AppAiLicia::onClose()
{
    mclog::tagInfo(getAppInfo().name, "on close");
    if (_client) {
        _client->stop();
        _client.reset();
    }
    {
        LvglLockGuard lock;
        destroyDesktopPicker();
        GetHAL().showRgbColor(0, 0, 0);
        GetStackChan().clearModifiers();
        GetStackChan().resetAvatar();
        view::destroy_home_indicator();
        view::destroy_status_bar();
    }
    GetHAL().requestWarmReboot(0);
}

void AppAiLicia::updateStatus()
{
    if (!_client || !GetStackChan().hasAvatar()) return;
    const auto state = _client->state();
    const auto status = _client->statusText();
    if (status != _last_status) {
        _last_status = status;
        if (state == AiLiciaConnectionState::Ready) GetStackChan().avatar().clearSpeech();
        else GetStackChan().avatar().setSpeech(status);
    }

    if (state == AiLiciaConnectionState::ChooseDesktop) {
        const auto desktops = _client->desktops();
        size_t signature = desktops.size();
        for (const auto& desktop : desktops) {
            signature ^= std::hash<std::string>{}(desktop.installationId) + 0x9e3779b9 +
                         (signature << 6) + (signature >> 2);
        }
        if (!_picker_panel || signature != _picker_signature) {
            _picker_signature = signature;
            rebuildDesktopPicker(desktops);
        }
    } else {
        destroyDesktopPicker();
    }
}

void AppAiLicia::rebuildDesktopPicker(const std::vector<AiLiciaDesktopEndpoint>& desktops)
{
    destroyDesktopPicker();
    _picker_panel = std::make_unique<Container>(lv_screen_active());
    _picker_panel->setBgColor(lv_color_hex(0x251B52));
    _picker_panel->align(LV_ALIGN_CENTER, 0, 0);
    _picker_panel->setSize(320, 240);
    _picker_panel->setBorderWidth(0);
    _picker_panel->setRadius(0);

    _picker_title = std::make_unique<Label>(_picker_panel->get());
    _picker_title->setText("Choose ai_licia Desktop");
    _picker_title->setTextFont(&lv_font_montserrat_20);
    _picker_title->setTextColor(lv_color_white());
    _picker_title->align(LV_ALIGN_TOP_MID, 0, 24);

    const size_t visibleCount = std::min<size_t>(desktops.size(), 3);
    for (size_t index = 0; index < visibleCount; ++index) {
        const auto endpoint = desktops[index];
        auto button = std::make_unique<Button>(_picker_panel->get());
        button->setSize(270, 44);
        button->align(LV_ALIGN_TOP_MID, 0, 62 + static_cast<int>(index) * 52);
        button->setBgColor(lv_color_hex(0x9C86FA));
        button->setBorderWidth(0);
        button->setRadius(14);
        button->label().setText(endpoint.displayName);
        button->label().setTextFont(&lv_font_montserrat_14);
        button->label().setTextColor(lv_color_hex(0x251B52));
        button->onClick().connect([this, installationId = endpoint.installationId]() {
            if (_client) _client->selectDesktop(installationId);
        });
        _picker_buttons.push_back(std::move(button));
    }
}

void AppAiLicia::destroyDesktopPicker()
{
    _picker_buttons.clear();
    _picker_title.reset();
    _picker_panel.reset();
    _picker_signature = 0;
}

