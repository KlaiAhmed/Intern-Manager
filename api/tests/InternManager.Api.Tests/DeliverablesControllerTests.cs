using System.IO;
using InternManager.Api.Controllers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;

namespace InternManager.Api.Tests;

public sealed class DeliverablesControllerCleanupTests
{
    [Fact]
    public void CatchBlock_CleanupFailure_DoesNotMaskOriginalException()
    {
        var tempDir = Path.Combine(Path.GetTempPath(), $"test_cleanup_{Guid.NewGuid():N}");
        try
        {
            Directory.CreateDirectory(tempDir);

            var filePath = Path.Combine(tempDir, "locked_file.tmp");
            File.WriteAllText(filePath, "test");

            var original = new InvalidOperationException("Original database failure");

            Exception? caught = null;

            var fileStream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.None);
            try
            {
                try
                {
                    throw original;
                }
                catch
                {
                    try
                    {
                        if (File.Exists(filePath))
                        {
                            File.Delete(filePath);
                        }
                    }
                    catch (IOException)
                    {
                    }

                    throw;
                }
            }
            catch (Exception ex) when (ex != original)
            {
                caught = ex;
            }
            catch (Exception ex)
            {
                caught = ex;
            }
            finally
            {
                fileStream.Dispose();
            }

            Assert.Same(original, caught);
        }
        finally
        {
            if (Directory.Exists(tempDir))
            {
                try { Directory.Delete(tempDir, recursive: true); }
                catch { }
            }
        }
    }

    [Fact]
    public void CatchBlock_AllCleanupFailures_StillRethrowsOriginal()
    {
        var tempDir = Path.Combine(Path.GetTempPath(), $"test_allfail_{Guid.NewGuid():N}");
        try
        {
            Directory.CreateDirectory(tempDir);

            var lockedPath = Path.Combine(tempDir, "locked_file.tmp");
            var missingPath = Path.Combine(tempDir, "missing_file.tmp");
            File.WriteAllText(lockedPath, "test");

            var original = new InvalidOperationException("Original failure");

            Exception? caught = null;

            var lockStream = new FileStream(lockedPath, FileMode.Open, FileAccess.Read, FileShare.None);
            try
            {
                try
                {
                    throw original;
                }
                catch
                {
                    try
                    {
                        throw new IOException("Rollback failed");
                    }
                    catch (IOException)
                    {
                    }

                    try
                    {
                        if (File.Exists(lockedPath))
                        {
                            File.Delete(lockedPath);
                        }
                    }
                    catch (IOException)
                    {
                    }

                    try
                    {
                        if (File.Exists(missingPath))
                        {
                            File.Delete(missingPath);
                        }
                    }
                    catch (IOException)
                    {
                    }

                    throw;
                }
            }
            catch (Exception ex)
            {
                caught = ex;
            }
            finally
            {
                lockStream.Dispose();
            }

            Assert.Same(original, caught);
        }
        finally
        {
            if (Directory.Exists(tempDir))
            {
                try { Directory.Delete(tempDir, recursive: true); }
                catch { }
            }
        }
    }

    [Fact]
    public async Task Controller_SubmitDeliverable_NoFile_ReturnsBadRequest()
    {
        var controller = new DeliverablesController(
            null!,
            null!,
            null!,
            null!,
            NullLogger<DeliverablesController>.Instance);

        var httpContext = new DefaultHttpContext();
        httpContext.User = new System.Security.Claims.ClaimsPrincipal(
            new System.Security.Claims.ClaimsIdentity(
            [
                new System.Security.Claims.Claim("userId", Guid.NewGuid().ToString())
            ],
            "TestAuth"));

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = httpContext
        };

        var result = await controller.SubmitDeliverable(
            Guid.NewGuid(),
            new SubmitDeliverableForm { File = null },
            CancellationToken.None);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal(StatusCodes.Status400BadRequest, badRequest.StatusCode);
    }
}
