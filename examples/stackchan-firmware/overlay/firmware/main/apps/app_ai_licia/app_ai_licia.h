/*
 * SPDX-FileCopyrightText: 2026 NovaSquare Ltd
 *
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include "ai_licia_client.h"

#include <memory>
#include <string>
#include <vector>
#include <mooncake.h>
#include <smooth_lvgl.hpp>
#include <uitk/short_namespace.hpp>

class AppAiLicia : public mooncake::AppAbility {
public:
    AppAiLicia();
    void onCreate() override;
    void onOpen() override;
    void onRunning() override;
    void onClose() override;

private:
    void updateStatus();
    void rebuildDesktopPicker(const std::vector<AiLiciaDesktopEndpoint>& desktops);
    void destroyDesktopPicker();

    std::unique_ptr<AiLiciaAvatarClient> _client;
    std::string _last_status;
    size_t _picker_signature = 0;
    std::unique_ptr<uitk::lvgl_cpp::Container> _picker_panel;
    std::unique_ptr<uitk::lvgl_cpp::Label> _picker_title;
    std::vector<std::unique_ptr<uitk::lvgl_cpp::Button>> _picker_buttons;
};

